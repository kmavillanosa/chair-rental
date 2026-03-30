const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function isLocalHostname(hostname: string) {
  return LOCAL_HOSTNAMES.has(String(hostname || '').trim().toLowerCase());
}

function isRunningOnPublicHost() {
  if (typeof window === 'undefined') return true;
  return !isLocalHostname(window.location.hostname);
}

export function resolveSafeUrl(configuredValue: string | undefined, fallbackValue: string) {
  const fallback = String(fallbackValue || '').trim();
  const configured = String(configuredValue || '').trim();
  if (!configured) return fallback;

  try {
    const parsed = new URL(configured);
    if (isRunningOnPublicHost() && isLocalHostname(parsed.hostname)) {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

export function resolveOptionalSafeUrl(configuredValue: string | undefined) {
  const configured = String(configuredValue || '').trim();
  if (!configured) return null;

  try {
    const parsed = new URL(configured);
    if (isRunningOnPublicHost() && isLocalHostname(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function resolveSafeApiBaseUrl() {
  return resolveSafeUrl(import.meta.env.VITE_API_URL, 'http://api.rentalbasic.com').replace(/\/+$/, '');
}

export function resolveSafeDocsUrl() {
  return resolveOptionalSafeUrl(import.meta.env.VITE_DOCS_URL);
}