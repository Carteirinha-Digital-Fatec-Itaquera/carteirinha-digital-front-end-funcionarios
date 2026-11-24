import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { getProfile, getPhoto, imageBytes } from "./api/employee";
import type { EmployeePhotoStatusView } from "./domains/employee";
import { useSession } from "./session";
import {
  prunePrivatePhotos,
  resourceEntry,
  revalidateResource,
  subscribeResource,
  type ResourceEntry,
} from "./resourceCache";

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}
function useEntry(entry: ResourceEntry, refresh = true) {
  const online = useOnline();
  const subscribe = useCallback(
    (listener: () => void) => subscribeResource(entry, listener),
    [entry],
  );
  const snapshot = useCallback(() => entry.snapshot, [entry]);
  const result = useSyncExternalStore(subscribe, snapshot);
  const reload = useCallback(() => {
    if (navigator.onLine) void revalidateResource(entry, true);
  }, [entry]);
  useEffect(() => {
    if (!online) return;
    void revalidateResource(entry);
    if (!refresh) return;
    const focus = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    const timer = window.setInterval(focus, 30000);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
      clearInterval(timer);
    };
  }, [entry, online, refresh, reload]);
  return {
    ...result,
    error: online ? result.error : "Você está sem conexão.",
    loading: online && result.loading,
    reload,
  };
}
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const session = useSession();
  const entry = useMemo(() => {
    void session;
    return resourceEntry(
      load,
      load,
      load === getProfile || load === getPhoto ? 15000 : 0,
    );
  }, [load, session]);
  const result = useEntry(entry);
  useEffect(() => {
    if (load !== getPhoto || !result.data) return;
    const photo = result.data as EmployeePhotoStatusView;
    prunePrivatePhotos([photo.approved?.contentUrl, photo.pending?.contentUrl]);
  }, [load, result.data]);
  return { ...result, data: result.data as T | undefined };
}
export function usePhotoUrl(
  path: string | null | undefined,
  privateImage = true,
) {
  const session = useSession();
  const entry = useMemo(() => {
    void session;
    return resourceEntry(
      (privateImage ? "private:" : "public:") + (path || ""),
      async (signal) =>
        path
          ? URL.createObjectURL(await imageBytes(path, privateImage, signal))
          : "",
      Infinity,
      (data) => {
        if (typeof data === "string" && data) URL.revokeObjectURL(data);
      },
    );
  }, [path, privateImage, session]);
  const result = useEntry(entry, false);
  return (result.data as string | undefined) || "";
}
