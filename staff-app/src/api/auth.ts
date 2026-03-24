import api from './axios';
import type { User } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const loginWithGoogle = () => {
  window.location.href = `${API_URL}/auth/google`;
};

export const impersonateUser = (targetUserId: string) =>
  api
    .post<{ access_token: string; user: User; impersonation?: { active: boolean } }>(
      '/auth/impersonate',
      { targetUserId },
    )
    .then((r) => r.data);
