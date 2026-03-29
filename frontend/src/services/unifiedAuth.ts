export interface UnifiedAuthSession {
  token: string;
  account_id: string;
  nickname?: string | null;
  expires_at: string | null;
  source: 'auth-platform';
  verify_mode: 'online' | 'offline';
  offline_validated_at?: string | null;
}

function parseJwtPayload(token: string): Record<string, any> {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

export interface LicenseState {
  product?: string;
  plugin: string;
  licensed: boolean;
  expires_at?: string | null;
}

const SESSION_KEY = 'unified-auth-session';
const LICENSE_CACHE_KEY = 'unified-auth-license-cache';

export function getStoredSession(): UnifiedAuthSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UnifiedAuthSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: UnifiedAuthSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem('token', session.token);
  const payload = parseJwtPayload(session.token);
  const nickname = session.nickname || payload.nickname || null;
  localStorage.setItem('user', JSON.stringify({
    username: nickname || session.account_id,
    role: 'superadmin',
    display_name: nickname || '超级管理员',
    account_id: session.account_id,
    auth_source: '统一认证平台',
    expires_at: session.expires_at,
    verify_mode: session.verify_mode,
  }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LICENSE_CACHE_KEY);
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getLicenseCache(): Record<string, LicenseState> {
  const raw = localStorage.getItem(LICENSE_CACHE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, LicenseState>;
  } catch {
    localStorage.removeItem(LICENSE_CACHE_KEY);
    return {};
  }
}

export function setLicenseCache(plugin: string, data: LicenseState) {
  const cache = getLicenseCache();
  cache[plugin] = data;
  localStorage.setItem(LICENSE_CACHE_KEY, JSON.stringify(cache));
}
