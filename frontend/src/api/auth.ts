import api, { setAuthToken } from './axios';

export async function login(identifier: string, password: string) {
  try {
    const payload = { identifier, password };
    const res = await api.post('/api/auth/login', payload);
    setAuthToken(res.data.token);
    return res.data;
  } catch (err: any) {
    if (err?.response?.data) {
      const data = err.response.data;
      const msg = data.message || data.error || JSON.stringify(data);
      const e = new Error(msg);
      (e as any).response = err.response;
      throw e;
    }
    throw err;
  }
}

export async function getMe() {
  const res = await api.get('/api/users/me');
  return res.data;
}
