import { useSyncExternalStore } from 'react';
import { sessionKey } from './api/config/apiClient';

function subscribe(listener: () => void) {
  window.addEventListener(sessionKey, listener);
  return () => window.removeEventListener(sessionKey, listener);
}
export function setSession(token: string | null) {
  if (token) sessionStorage.setItem(sessionKey, token);
  else sessionStorage.removeItem(sessionKey);
  window.dispatchEvent(new Event(sessionKey));
}
export function useSession() {
  return useSyncExternalStore(subscribe, () => sessionStorage.getItem(sessionKey));
}
