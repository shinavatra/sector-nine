export type AdminTokenIdentity = { sub: string; av?: number }

export type CanonicalAdminAccount = {
  id: string
  role: string
  auth_version?: number | null
  deleted_at?: Date | string | null
} | null | undefined

export type AdminAuthorizationRejection =
  | 'account_not_found'
  | 'account_not_active'
  | 'auth_version_mismatch'
  | 'role_not_admin'

export const adminAuthorizationRejection = (
  payload: AdminTokenIdentity,
  account: CanonicalAdminAccount,
): AdminAuthorizationRejection | null => {
  if (!account) return 'account_not_found'
  if (account.deleted_at) return 'account_not_active'
  if (Number(payload.av || 0) !== Number(account.auth_version || 0)) return 'auth_version_mismatch'
  if (account.role !== 'admin') return 'role_not_admin'
  return null
}
