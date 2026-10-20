import {apiFetch,ApiError} from './api'

const configuredApiUrl = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '')
const API_URL = configuredApiUrl || ((import.meta as any).env?.DEV ? 'http://localhost:3001' : '')

export class AdminApiError extends Error {
  constructor(message: string, public status: number, public code: string, public details?: unknown) {
    super(message)
    this.name = 'AdminApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new AdminApiError('VITE_API_URL is not configured', 500, 'API_URL_NOT_CONFIGURED')

  try{return await apiFetch(`/admin${path}`,options) as T}catch(error){
    if(error instanceof ApiError)throw new AdminApiError(error.message,error.status,error.code||`HTTP_${error.status}`)
    throw error
  }
}

export const adminAPI = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string, data?: unknown) => request<T>(path, { method: 'DELETE', ...(data===undefined?{}:{ body: JSON.stringify(data) }) }),
}
