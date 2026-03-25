const API_URL =
  String(import.meta.env.VITE_API_URL || 'http://api.rentalbasic.com').trim();

export const loginWithGoogle = () => {
  window.location.href = `${API_URL}/auth/google`;
};
