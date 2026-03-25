import { resolveSafeApiBaseUrl } from '../utils/envUrl';

const API_URL = resolveSafeApiBaseUrl();

export const loginWithGoogle = () => {
  window.location.href = `${API_URL}/auth/google`;
};
