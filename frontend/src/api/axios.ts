import axios from 'axios';

const instance = axios.create({
  baseURL: '/',
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
