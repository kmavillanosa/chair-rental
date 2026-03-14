const POST_LOGIN_REDIRECT_KEY = 'app.postLoginRedirect';
const POST_LOGIN_REDIRECT_MAX_AGE_MS = 30 * 60 * 1000;

type StoredPostLoginRedirect = {
  path: string;
  createdAt: number;
};

function isSafeAppPath(path: string) {
  return path.startsWith('/') && !path.startsWith('//');
}

export function getCurrentAppPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function savePostLoginRedirect(path: string) {
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath) return;
  if (!isSafeAppPath(normalizedPath)) return;
  if (normalizedPath.startsWith('/login') || normalizedPath.startsWith('/auth/callback')) {
    return;
  }

  const payload: StoredPostLoginRedirect = {
    path: normalizedPath,
    createdAt: Date.now(),
  };

  try {
    window.sessionStorage.setItem(
      POST_LOGIN_REDIRECT_KEY,
      JSON.stringify(payload),
    );
  } catch {
    // Ignore storage failures and fall back to default login redirect behavior.
  }
}

export function consumePostLoginRedirect() {
  try {
    const raw = window.sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    if (!raw) return null;

    const payload = JSON.parse(raw) as Partial<StoredPostLoginRedirect>;
    const path = String(payload.path || '').trim();
    const createdAt = Number(payload.createdAt || 0);

    if (!path || !isSafeAppPath(path)) return null;
    if (!createdAt || Date.now() - createdAt > POST_LOGIN_REDIRECT_MAX_AGE_MS) {
      return null;
    }

    return path;
  } catch {
    return null;
  }
}

export function clearPostLoginRedirect() {
  try {
    window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  } catch {
    // Ignore storage failures.
  }
}