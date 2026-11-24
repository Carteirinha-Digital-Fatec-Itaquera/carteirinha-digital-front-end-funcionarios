import { sessionKey } from "./api/config/apiClient";

export type ResourceLoader = (signal: AbortSignal) => Promise<unknown>;
export type ResourceSnapshot = {
  data?: unknown;
  error?: string;
  loading: boolean;
  refreshing?: boolean;
};
type Key = ResourceLoader | string;
export type ResourceEntry = {
  load: ResourceLoader;
  snapshot: ResourceSnapshot;
  listeners: Set<() => void>;
  controller?: AbortController;
  pending?: Promise<void>;
  updatedAt: number;
  ttl: number;
  dispose?: (data: unknown) => void;
};
const entries = new Map<Key, ResourceEntry>();
const dismissed = new Set<string>();
let scope = sessionStorage.getItem(sessionKey);
let epoch = 0;
function publish(entry: ResourceEntry, snapshot: ResourceSnapshot) {
  entry.snapshot = snapshot;
  entry.listeners.forEach((listener) => listener());
}
function synchronizeSession() {
  const next = sessionStorage.getItem(sessionKey);
  if (scope === next) return;
  scope = next;
  epoch++;
  dismissed.clear();
  entries.forEach((entry) => {
    entry.controller?.abort();
    entry.dispose?.(entry.snapshot.data);
    publish(entry, { loading: true });
  });
  entries.clear();
}
window.addEventListener(sessionKey, synchronizeSession);
export function resourceEntry(
  key: Key,
  load: ResourceLoader,
  ttl = 15000,
  dispose?: (data: unknown) => void,
): ResourceEntry {
  synchronizeSession();
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      load,
      ttl,
      dispose,
      snapshot: { loading: true },
      listeners: new Set(),
      updatedAt: 0,
    };
    entries.set(key, entry);
  }
  return entry;
}
export function subscribeResource(entry: ResourceEntry, listener: () => void) {
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    // Credenciais, verificações públicas e suporte exigem uma leitura nova ao remontar.
    if (!entry.listeners.size && entry.ttl === 0) {
      entry.controller?.abort();
      entry.pending = undefined;
      entry.updatedAt = 0;
      entry.snapshot = { loading: true };
    }
  };
}
export function revalidateResource(entry: ResourceEntry, force = false) {
  synchronizeSession();
  if (entry.pending) return entry.pending;
  if (!force && entry.updatedAt && Date.now() - entry.updatedAt < entry.ttl)
    return;
  const controller = new AbortController();
  const requestEpoch = epoch;
  entry.controller = controller;
  publish(entry, {
    ...entry.snapshot,
    error: undefined,
    refreshing: true,
    loading: entry.snapshot.data === undefined,
  });
  entry.pending = Promise.resolve()
    .then(() => entry.load(controller.signal))
    .then(
      (data) => {
        if (
          controller.signal.aborted ||
          requestEpoch !== epoch ||
          scope !== sessionStorage.getItem(sessionKey)
        ) {
          entry.dispose?.(data);
          return;
        }
        if (entry.snapshot.data !== data) entry.dispose?.(entry.snapshot.data);
        entry.updatedAt = Date.now();
        publish(entry, { data, loading: false });
      },
      (error: unknown) => {
        if (controller.signal.aborted || requestEpoch !== epoch) return;
        publish(entry, {
          data: entry.snapshot.data,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível atualizar os dados.",
        });
      },
    )
    .finally(() => {
      if (entry.controller === controller) entry.pending = undefined;
    });
  return entry.pending;
}
export function invalidateResources(loaders: ResourceLoader[]) {
  synchronizeSession();
  loaders.forEach((loader) => {
    const entry = entries.get(loader);
    if (!entry) return;
    entry.controller?.abort();
    entry.pending = undefined;
    entry.updatedAt = 0;
    if (entry.listeners.size) void revalidateResource(entry, true);
  });
}
export function isNoticeDismissed(id: string) {
  synchronizeSession();
  return dismissed.has(id);
}
export function dismissNotice(id: string) {
  synchronizeSession();
  dismissed.add(id);
}

export function prunePrivatePhotos(paths: Array<string | null | undefined>) {
  synchronizeSession();
  const allowed = new Set(
    paths.filter(Boolean).map((path) => "private:" + path),
  );
  for (const [key, entry] of entries) {
    if (
      typeof key !== "string" ||
      !key.startsWith("private:/") ||
      allowed.has(key)
    )
      continue;
    entry.controller?.abort();
    entry.dispose?.(entry.snapshot.data);
    publish(entry, { loading: false });
    entries.delete(key);
  }
}
