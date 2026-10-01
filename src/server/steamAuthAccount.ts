export type SteamLoginResolution = 'existing' | 'created' | 'race_existing'

type SteamLoginDependencies<User, Summary> = {
  steamId: string
  summary: Summary
  findBySteamId: (steamId: string) => Promise<User | undefined>
  createUser: (steamId: string, summary: Summary) => Promise<User>
  updateProfile: (user: User, steamId: string, summary: Summary) => Promise<User>
}

export const isPostgresUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'

export const resolveSteamLoginUser = async <User, Summary>({
  steamId,
  summary,
  findBySteamId,
  createUser,
  updateProfile,
}: SteamLoginDependencies<User, Summary>): Promise<{
  user: User
  createdAccount: boolean
  resolution: SteamLoginResolution
}> => {
  const existingUser = await findBySteamId(steamId)
  if (existingUser) {
    return {
      user: await updateProfile(existingUser, steamId, summary),
      createdAccount: false,
      resolution: 'existing',
    }
  }

  try {
    return {
      user: await createUser(steamId, summary),
      createdAccount: true,
      resolution: 'created',
    }
  } catch (error) {
    if (!isPostgresUniqueViolation(error)) throw error

    // Once PostgreSQL reports the conflict, the concurrent winner is visible.
    const racedUser = await findBySteamId(steamId)
    if (!racedUser) throw error

    return {
      user: await updateProfile(racedUser, steamId, summary),
      createdAccount: false,
      resolution: 'race_existing',
    }
  }
}
