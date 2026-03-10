import api from '../api/axios';

type CacheEntry = { ts: number; data: any[] } | null;
const TTL_MS = 5 * 1000; // 5 seconds (reduced for fresher data)
let cache: CacheEntry = null;

export async function getUsersCached() {
  const now = Date.now();
  if (cache && (now - cache.ts) < TTL_MS) return cache.data;
  // Prefer fetching current user first so we can avoid requesting the admin-only endpoint when unnecessary
  try {
    const meRes = await api.get('/api/users/me')
    const me = meRes?.data || null
    const role = (me && me.role) ? String(me.role).toLowerCase() : null
    const deptId = me?.department_id || me?.department || null

    if (role === 'admin') {
      const res = await api.get('/api/users')
      const data = Array.isArray(res.data) ? res.data : []
      cache = { ts: now, data }
      return data
    }

    if (deptId) {
      const depRes = await api.get(`/api/users/department/${deptId}`)
      const data = Array.isArray(depRes.data) ? depRes.data : []
      cache = { ts: now, data }
      return data
    }
  } catch (meErr: any) {
    // If fetching /me fails (unauthenticated or other), fall back to previous approach
    try {
      const res = await api.get('/api/users')
      const data = Array.isArray(res.data) ? res.data : []
      cache = { ts: now, data }
      return data
    } catch (err: any) {
      if (err && err.response && err.response.status === 403) {
        // try to recover: request /api/users/me then department list
        try {
          const meRes2 = await api.get('/api/users/me')
          const me2 = meRes2?.data || null
          const deptId2 = me2?.department_id || me2?.department || null
          if (deptId2) {
            const depRes = await api.get(`/api/users/department/${deptId2}`)
            const data = Array.isArray(depRes.data) ? depRes.data : []
            cache = { ts: now, data }
            return data
          }
        } catch (_e) {
          // give up
        }
      }
      cache = { ts: now, data: [] }
      return []
    }
  }

  // No specific data found, return empty
  cache = { ts: now, data: [] }
  return []
}

export function clearUsersCache() {
  cache = null;
}
