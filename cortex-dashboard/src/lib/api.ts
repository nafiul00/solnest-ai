import { getAuthHeader, useAuthStore } from '../store/authStore'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function headers(extra?: Record<string, string>): Record<string, string> {
  const auth = getAuthHeader()
  return {
    'Content-Type': 'application/json',
    ...(auth ? { Authorization: auth } : {}),
    ...extra,
  }
}

async function request(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init)
  if (res.status === 401) {
    useAuthStore.getState().logout()
    throw new Error('Unauthorized — session expired')
  }
  return res.json()
}

export const api = {
  get: (path: string) =>
    request(BASE + path, { headers: headers() }),

  post: (path: string, body?: unknown) =>
    request(BASE + path, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    }),

  patch: (path: string, body?: unknown) =>
    request(BASE + path, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(body),
    }),

  delete: (path: string) =>
    request(BASE + path, {
      method: 'DELETE',
      headers: headers(),
    }),
}
