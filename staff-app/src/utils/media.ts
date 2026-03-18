const LOCAL_MEDIA_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'api',
  'chair_rental_api',
]);

function resolveApiOrigin(): string {
  const configured = String(import.meta.env.VITE_API_URL || '').trim();
  if (!configured) return window.location.origin;

  try {
    return new URL(configured, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

function normalizeMediaPath(raw: string): string {
  let normalized = raw.replace(/\\+/g, '/').trim();

  if (/^\/?api\/uploads\//i.test(normalized)) {
    normalized = normalized.replace(/^\/?api\/uploads\//i, '/uploads/');
  }

  if (/^uploads\//i.test(normalized)) {
    normalized = `/${normalized}`;
  }

  return normalized;
}

export function resolveMediaUrl(value?: string | null): string {
  const input = String(value || '').trim();
  if (!input) return '';

  if (input.startsWith('data:') || input.startsWith('blob:')) {
    return input;
  }

  const apiOrigin = resolveApiOrigin();

  if (/^(https?:)?\/\//i.test(input)) {
    try {
      const absolute = new URL(input, window.location.origin);
      const isUploadPath = absolute.pathname.startsWith('/uploads/');

      if (isUploadPath && LOCAL_MEDIA_HOSTS.has(absolute.hostname.toLowerCase())) {
        return new URL(`${absolute.pathname}${absolute.search}${absolute.hash}`, apiOrigin).toString();
      }

      return absolute.toString();
    } catch {
      return input;
    }
  }

  const normalizedInput = normalizeMediaPath(input);

  try {
    return new URL(normalizedInput, apiOrigin).toString();
  } catch {
    return normalizedInput;
  }
}
