export type AuthTokenPayload = {
  sub: string
  email?: string
  av?: number
}

export type AuthAccountState = {
  auth_version?: number | null
  deleted_at?: Date | string | null
} | null | undefined

export type AuthSessionRejection = 'account_not_found' | 'account_not_active' | 'auth_version_mismatch'

export const authSessionRejection = (
  payload: AuthTokenPayload,
  account: AuthAccountState,
): AuthSessionRejection | null => {
  if (!account) return 'account_not_found'
  if (account.deleted_at) return 'account_not_active'
  if (Number(payload.av || 0) !== Number(account.auth_version || 0)) return 'auth_version_mismatch'
  return null
}
