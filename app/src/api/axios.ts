import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { getCurrentAppPath, savePostLoginRedirect } from '../utils/postLoginRedirect';
import { resolveSafeApiBaseUrl } from '../utils/envUrl';

const api = axios.create({
  baseURL: resolveSafeApiBaseUrl(),
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      savePostLoginRedirect(getCurrentAppPath());
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
