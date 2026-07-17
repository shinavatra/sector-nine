const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'

export class AdminApiError extends Error {
  constructor(message: string, public status: number, public code: string, public details?: unknown) {
    super(message)
    this.name = 'AdminApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('session_token')
  const response = await fetch(`${API_URL}/admin${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new AdminApiError(
    body.error || `Admin request failed (${response.status})`,
    response.status,
    body.code || `HTTP_${response.status}`,
    body.details,
  )
  return body
}

export const adminAPI = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string, data?: unknown) => request<T>(path, { method: 'DELETE', ...(data===undefined?{}:{ body: JSON.stringify(data) }) }),
}
