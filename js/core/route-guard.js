import { getSession } from './auth-storage.js';

export function requireSession() {
  if (!getSession()) {
    const next = encodeURIComponent(`${location.pathname.split('/').pop() || 'dashboard.html'}${location.search}`);
    location.replace(`./login.html?next=${next}`);
    return false;
  }
  return true;
}
