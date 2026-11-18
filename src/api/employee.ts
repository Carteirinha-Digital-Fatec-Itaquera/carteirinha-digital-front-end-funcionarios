import type {
  EmployeeLoginResponse, EmployeeProfileView, EmployeeCredentialCardView, EmployeePhotoStatusView,
  EmployeePhotoUploadResponse, PublicEmployeeVerificationResponse, PublicInstitutionInfoResponse,
  EmployeeChangePasswordResponse, EmployeeGenericAcceptedResponse, EmployeeActivateResponse,
  EmployeeResetPasswordResponse, EmployeePhotoRemoveRequest,
} from '../domains/employee';
import { apiClient, buildApiError, json } from './config/apiClient';

const auth = '/autenticacao/funcionarios/';
const self = '/funcionarios/me';
export const login = (email: string, password: string) =>
  json<EmployeeLoginResponse>(auth + 'login', { method: 'POST', body: { email, password } });
export const requestAccess = (email: string, recovery: boolean) =>
  json<EmployeeGenericAcceptedResponse>(auth + (recovery ? 'forgot-password' : 'solicitar-acesso'),
    { method: 'POST', body: { email } });
export const redeemActionToken = (token: string, newPassword: string, recovery: boolean) =>
  json<EmployeeActivateResponse | EmployeeResetPasswordResponse>(auth + (recovery ? 'reset' : 'ativar'),
    { method: 'POST', body: { token, newPassword } });
export const changePassword = (currentPassword: string, newPassword: string) =>
  json<EmployeeChangePasswordResponse>(auth + 'alterar-senha',
    { method: 'POST', authenticated: true, body: { currentPassword, newPassword } });
export const getProfile = (signal?: AbortSignal) =>
  json<EmployeeProfileView>(self, { authenticated: true, signal });
export const getCard = (signal?: AbortSignal) =>
  json<EmployeeCredentialCardView>(self + '/carteirinha', { authenticated: true, signal });
export const getPhoto = (signal?: AbortSignal) =>
  json<EmployeePhotoStatusView>(self + '/foto', { authenticated: true, signal });
export const getInstitution = (signal?: AbortSignal) =>
  json<PublicInstitutionInfoResponse>('/public/institution', { signal });
export const verifyCard = (qrcode: string, signal?: AbortSignal) =>
  json<PublicEmployeeVerificationResponse>('/funcionarios/verificar/' + encodeURIComponent(qrcode), { signal });

export async function imageBytes(path: string, privateImage: boolean, signal: AbortSignal) {
  const allowed = privateImage
    ? /^\/funcionarios\/me\/fotos\/[\w-]+\/conteudo$/
    : /^\/funcionarios\/verificar\/[^/]+\/foto$/;
  if (!allowed.test(path)) throw new Error('Endereço de foto inválido.');
  const response = await apiClient(path, { authenticated: privateImage, signal });
  if (!response.ok) throw await buildApiError(response);
  return response.blob();
}

export function uploadPhoto(file: File, expectedVersion: number, requestId: string) {
  const form = new FormData();
  form.set('file', file);
  form.set('expectedVersion', String(expectedVersion));
  form.set('requestId', requestId);
  return json<EmployeePhotoUploadResponse>(self + '/foto', { method: 'POST', authenticated: true, body: form });
}

export function removePhoto(body: EmployeePhotoRemoveRequest) {
  return json(self + '/foto', { method: 'DELETE', authenticated: true, body });
}
