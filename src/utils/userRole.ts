export type RoleBearingUser = { role?: unknown } | null | undefined

export const isAdminUser = (user: RoleBearingUser): boolean => user?.role === 'admin'

export const showPlayerProgression = (user: RoleBearingUser): boolean => Boolean(user) && !isAdminUser(user)
