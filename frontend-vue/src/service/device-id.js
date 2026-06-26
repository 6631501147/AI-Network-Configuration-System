const DEVICE_ID_KEY = 'trusted-device-id-v1';
const DEVICE_COOKIE_KEY = 'iam-device-id-v1';
const DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
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

function normalizeDeviceId(value) {
  const normalized = value ? String(value).trim() : '';
  if (!normalized) return '';
  if (normalized.length < 8 || normalized.length > 200) return '';
  return /^[a-zA-Z0-9._:-]+$/.test(normalized) ? normalized : '';
}

function readCookie(name) {
  if (typeof document === 'undefined') return '';
  const prefix = `${name}=`;
  const found = String(document.cookie || '')
    .split(';')
    .map(item => item.trim())
    .find(item => item.indexOf(prefix) === 0);
  return found ? decodeURIComponent(found.slice(prefix.length)) : '';
}

function writeCookie(deviceId) {
  if (typeof document === 'undefined' || !deviceId) return;
  const parts = [
    `${DEVICE_COOKIE_KEY}=${encodeURIComponent(deviceId)}`,
    'Path=/',
    `Max-Age=${DEVICE_MAX_AGE_SECONDS}`,
    'SameSite=Lax'
  ];
  const domain = getCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') {
    parts.push('Secure');
  }
  document.cookie = parts.join('; ');
}

function createDeviceId() {
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateDeviceId() {
  const storage = getStorage();
  const cookieDeviceId = normalizeDeviceId(readCookie(DEVICE_COOKIE_KEY));
  if (cookieDeviceId) {
    if (storage) storage.setItem(DEVICE_ID_KEY, cookieDeviceId);
    return cookieDeviceId;
  }

  const storedDeviceId = normalizeDeviceId(storage ? storage.getItem(DEVICE_ID_KEY) : '');
  if (storedDeviceId) {
    writeCookie(storedDeviceId);
    return storedDeviceId;
  }

  const deviceId = createDeviceId();
  if (storage) storage.setItem(DEVICE_ID_KEY, deviceId);
  writeCookie(deviceId);
  return deviceId;
}
