import { resolveSafeApiBaseUrl } from './envUrl';

const API_BASE_URL = resolveSafeApiBaseUrl() || window.location.origin;

export function resolveMediaUrl(value?: string | null): string {
  const input = String(value || '').trim();
  if (!input) return '';

  if (/^(https?:)?\/\//i.test(input) || input.startsWith('data:') || input.startsWith('blob:')) {
    return input;
  }

  try {
    return new URL(input, API_BASE_URL).toString();
  } catch {
    return input;
  }
}
