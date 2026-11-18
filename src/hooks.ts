import { useEffect, useReducer, useState } from 'react';
import { imageBytes } from './api/employee';

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  return online;
}

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const online = useOnline();
  const [version, reload] = useReducer((n: number) => n + 1, 0);
  const [result, setResult] = useState<{ load: typeof load; version: number; data?: T; error?: string }>();
  useEffect(() => {
    if (!online) return;
    const controller = new AbortController();
    void load(controller.signal).then(
      data => { if (!controller.signal.aborted) setResult({ load, version, data }); },
      error => { if (!controller.signal.aborted) setResult({ load, version, error: error.message }); },
    );
    return () => controller.abort();
  }, [load, version, online]);
  const current = online && result?.load === load && result.version === version ? result : undefined;
  return { data: current?.data, error: online ? current?.error : 'Você está sem conexão.',
    loading: online && !current, reload };
}

export function usePhotoUrl(path: string | null | undefined, privateImage = true) {
  const online = useOnline();
  const [result, setResult] = useState<{ path: string; url: string }>();
  useEffect(() => {
    if (!path || !online) return;
    const controller = new AbortController();
    let url: string | undefined;
    void imageBytes(path, privateImage, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setResult({ path, url });
    }).catch(() => {});
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, privateImage, online]);
  return online && result?.path === path ? result?.url ?? '' : '';
}
