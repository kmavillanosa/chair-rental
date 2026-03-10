const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const loginWithGoogle = () => {
  window.location.href = `${API_URL}/auth/google`;
};
