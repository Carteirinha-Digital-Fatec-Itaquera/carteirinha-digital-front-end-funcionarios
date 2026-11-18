export const sessionKey = 'carteirinha-funcionarios.session';

type Options = Omit<RequestInit, 'body'> & { authenticated?: boolean; body?: object };

export function apiUrl(path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new Error('Caminho inválido da API.');
  }
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '');
  if (!base) throw new Error('Configure VITE_API_BASE_URL para acessar o serviço.');
  return base + path;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function buildApiError(response: Response, _path?: string) {
  void _path;
  const data = await response.json().catch(() => null);
  return new ApiError(response.status, data?.code,
    (Array.isArray(data?.message) ? data.message.join('. ') : data?.message) ||
      (response.status === 429 ? 'Muitas tentativas. Aguarde e tente novamente.' : 'O serviço não conseguiu concluir a solicitação.'));
}

export async function apiClient(path: string, { authenticated, body, ...options }: Options = {}) {
  const headers = new Headers(options.headers);
  const token = authenticated ? sessionStorage.getItem(sessionKey) : null;
  if (authenticated && !token) throw new ApiError(401, undefined, 'Faça login para continuar.');
  if (token) headers.set('Authorization', 'Bearer ' + token);
  const multipart = body instanceof FormData;
  if (body && !multipart) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers, credentials: 'omit', cache: 'no-store',
      body: multipart ? body : body ? JSON.stringify(body) : undefined });
  } catch (error) {
    if (options.signal?.aborted || !(error instanceof TypeError)) throw error;
    throw new Error(navigator.onLine ? 'Não foi possível conectar ao serviço. Tente novamente.' : 'Você está sem conexão.');
  }
  if (token && sessionStorage.getItem(sessionKey) === token && !response.ok) {
    const failure = await buildApiError(response.clone());
    if (sessionStorage.getItem(sessionKey) === token &&
      (failure.status === 401 || failure.code === 'ACCOUNT_BLOCKED' || failure.code === 'ROLE_FORBIDDEN')) {
      sessionStorage.removeItem(sessionKey);
      window.dispatchEvent(new Event(sessionKey));
    }
  }
  return response;
}

export async function json<T>(path: string, options?: Options): Promise<T> {
  const response = await apiClient(path, options);
  if (!response.ok) throw await buildApiError(response);
  return response.json() as Promise<T>;
}
