import axios from 'axios';

const configuredApiOrigin = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

export function resolveApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!configuredApiOrigin) return normalizedPath;
  return `${configuredApiOrigin}${normalizedPath}`;
}

const instance = axios.create({
  baseURL: configuredApiOrigin ? `${configuredApiOrigin}/` : '/',
  headers: { 'Content-Type': 'application/json' }
});

const storedToken = (() => {
  try {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
  } catch {
    return null;
  }
})();
if (storedToken) {
  instance.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}

export function setAuthToken(token?: string | null) {
  if (token) instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete instance.defaults.headers.common['Authorization'];
}

export default instance;
