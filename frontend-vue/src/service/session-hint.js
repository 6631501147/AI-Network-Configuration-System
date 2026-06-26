const SESSION_HINT_KEY = 'iam-session-hint-v1';
const SESSION_HINT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function getCookieDomain() {
  if (typeof window === 'undefined' || !window.location) return '';
  const configured = process.env.VUE_APP_IAM_COOKIE_DOMAIN
    ? String(process.env.VUE_APP_IAM_COOKIE_DOMAIN).trim()
    : '';
  if (configured) return configured;

  const hostname = String(window.location.hostname || '').toLowerCase();
  if (!hostname || hostname === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return '';
  }
  if (hostname.endsWith('.mfu.ac.th')) return '.mfu.ac.th';
  return '';
}

function readCookie(name) {
  if (typeof document === 'undefined') return '';
  const prefix = `${name}=`;
  const found = String(document.cookie || '')
    .split(';')
    .map(item => item.trim())
    .find(item => item.indexOf(prefix) === 0);
  return found ? found.slice(prefix.length) : '';
}

function writeCookie(enabled) {
  if (typeof document === 'undefined') return;
  const parts = [
    `${SESSION_HINT_KEY}=${enabled ? '1' : ''}`,
    'Path=/',
    `Max-Age=${enabled ? SESSION_HINT_MAX_AGE_SECONDS : 0}`,
    'SameSite=Lax'
  ];
  const domain = getCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') {
    parts.push('Secure');
  }
  document.cookie = parts.join('; ');
}

export function hasSessionHint() {
  const storage = getStorage();
  if (storage && storage.getItem(SESSION_HINT_KEY) === '1') return true;
  const cookieValue = readCookie(SESSION_HINT_KEY);
  if (cookieValue === '1') {
    if (storage) storage.setItem(SESSION_HINT_KEY, '1');
    return true;
  }
  return false;
}

export function setSessionHint(enabled) {
  const storage = getStorage();
  if (storage && enabled) {
    storage.setItem(SESSION_HINT_KEY, '1');
  } else if (storage) {
    storage.removeItem(SESSION_HINT_KEY);
  }
  writeCookie(!!enabled);
}
