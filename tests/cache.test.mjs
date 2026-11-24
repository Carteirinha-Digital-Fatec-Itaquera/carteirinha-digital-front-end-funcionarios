import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const values = new Map();
globalThis.sessionStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
globalThis.window = new EventTarget();
const key = "carteirinha-funcionarios.session";
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText;
const dataUrl = (source) =>
  "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const api = dataUrl(
  compile(
    await readFile(
      new URL("../src/api/config/apiClient.ts", import.meta.url),
      "utf8",
    ),
  ),
);
const source = compile(
  await readFile(new URL("../src/resourceCache.ts", import.meta.url), "utf8"),
).replace("./api/config/apiClient", api);
const cache = await import(dataUrl(source));
const session = (value) => {
  sessionStorage.setItem(key, value);
  window.dispatchEvent(new Event(key));
};
let identity = 0;
beforeEach(() => session("synthetic-session-" + ++identity));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
test("deduplica consultas simultâneas e reutiliza dados frescos", async () => {
  let calls = 0;
  const gate = deferred();
  const load = () => {
    calls++;
    return gate.promise;
  };
  const first = cache.resourceEntry(load, load);
  const second = cache.resourceEntry(load, load);
  assert.equal(first, second);
  const p = cache.revalidateResource(first);
  assert.equal(cache.revalidateResource(second), p);
  await Promise.resolve();
  assert.equal(calls, 1);
  gate.resolve({ name: "Pessoa Sintética" });
  await p;
  await cache.revalidateResource(first);
  assert.equal(calls, 1);
  assert.equal(first.snapshot.data.name, "Pessoa Sintética");
});
test("mantém dados durante revalidação lenta e falha de rede", async () => {
  let next = Promise.resolve({ name: "Nome preservado" });
  const load = () => next;
  const entry = cache.resourceEntry(load, load);
  await cache.revalidateResource(entry);
  const gate = deferred();
  next = gate.promise;
  const p = cache.revalidateResource(entry, true);
  assert.equal(entry.snapshot.data.name, "Nome preservado");
  assert.equal(entry.snapshot.loading, false);
  gate.reject(new Error("Rede indisponível"));
  await p;
  assert.equal(entry.snapshot.data.name, "Nome preservado");
  assert.match(entry.snapshot.error, /Rede/);
});
test("logout limpa dados, revoga URL e descarta resposta tardia", async () => {
  const disposed = [];
  const gate = deferred();
  const load = () => gate.promise;
  const entry = cache.resourceEntry("private:test", load, Infinity, (value) => {
    if (value) disposed.push(value);
  });
  const p = cache.revalidateResource(entry);
  await Promise.resolve();
  session("outra-identidade");
  assert.equal(entry.snapshot.data, undefined);
  gate.resolve("blob:late");
  await p;
  assert.deepEqual(disposed, ["blob:late"]);
  const ready = cache.resourceEntry(
    "private:ready",
    async () => "blob:ready",
    Infinity,
    (value) => {
      if (value) disposed.push(value);
    },
  );
  await cache.revalidateResource(ready);
  session("nova-identidade");
  assert(disposed.includes("blob:ready"));
  assert.equal(ready.snapshot.data, undefined);
});
test("invalidação seletiva impede resposta antiga de sobrescrever a nova", async () => {
  const old = deferred();
  let calls = 0;
  const load = () =>
    ++calls === 1 ? old.promise : Promise.resolve({ status: "PENDING" });
  const entry = cache.resourceEntry(load, load);
  const stop = cache.subscribeResource(entry, () => {});
  const first = cache.revalidateResource(entry);
  await Promise.resolve();
  cache.invalidateResources([load]);
  await entry.pending;
  old.resolve({ status: "REJECTED" });
  await first;
  assert.equal(entry.snapshot.data.status, "PENDING");
  stop();
});
test("nova resposta válida substitui rejeição por aprovação", async () => {
  let data = { status: "REJECTED", reason: "Motivo sintético" };
  const load = async () => data;
  const entry = cache.resourceEntry(load, load);
  await cache.revalidateResource(entry);
  data = { status: "APPROVED" };
  await cache.revalidateResource(entry, true);
  assert.equal(entry.snapshot.data.status, "APPROVED");
  assert.equal(entry.snapshot.data.reason, undefined);
});
test("isolamento também funciona ao trocar token sem evento", async () => {
  const load = async () => ({ name: "Pessoa A" });
  const a = cache.resourceEntry(load, load);
  await cache.revalidateResource(a);
  sessionStorage.setItem(key, "pessoa-b");
  const b = cache.resourceEntry(load, load);
  assert.notEqual(a, b);
  assert.equal(a.snapshot.data, undefined);
  assert.equal(b.snapshot.data, undefined);
});
test("fechamento pertence à ocorrência e é limpo na troca de sessão", () => {
  cache.dismissNotice("rejeicao-1");
  assert(cache.isNoticeDismissed("rejeicao-1"));
  assert(!cache.isNoticeDismissed("rejeicao-2"));
  session("outra");
  assert(!cache.isNoticeDismissed("rejeicao-1"));
});

test("remoção revoga somente blobs que saíram do estado atual", async () => {
  const disposed = [];
  const dispose = (value) => {
    if (value) disposed.push(value);
  };
  const old = cache.resourceEntry(
    "private:/removed",
    async () => "blob:removed",
    Infinity,
    dispose,
  );
  const kept = cache.resourceEntry(
    "private:/approved",
    async () => "blob:approved",
    Infinity,
    dispose,
  );
  await cache.revalidateResource(old);
  await cache.revalidateResource(kept);
  cache.prunePrivatePhotos(["/approved"]);
  assert.deepEqual(disposed, ["blob:removed"]);
  assert.equal(old.snapshot.data, undefined);
  assert.equal(kept.snapshot.data, "blob:approved");
});

test("não reapresenta credencial antiga ao remontar recurso sem cache de navegação", async () => {
  const load = async () => ({ valid: true });
  const entry = cache.resourceEntry(load, load, 0);
  const stopA = cache.subscribeResource(entry, () => {});
  const stopB = cache.subscribeResource(entry, () => {});
  await cache.revalidateResource(entry);
  stopA();
  assert.equal(entry.snapshot.data.valid, true);
  stopB();
  assert.equal(entry.snapshot.data, undefined);
  assert.equal(cache.resourceEntry(load, load, 0).snapshot.loading, true);
});
