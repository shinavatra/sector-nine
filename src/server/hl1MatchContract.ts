export interface TrustedHl1Rules {
  fragLimit: number
  timeLimitSeconds: number | null
  disconnectPolicy: 'interrupt' | 'continue'
}

const hl1Rules: Record<string, TrustedHl1Rules> = {
  'classic-deathmatch': { fragLimit: 10, timeLimitSeconds: null, disconnectPolicy: 'interrupt' },
  'instagib-mode': { fragLimit: 10, timeLimitSeconds: null, disconnectPolicy: 'interrupt' },
}

export const trustedHl1Rules = (mode: string): TrustedHl1Rules | null => hl1Rules[mode] ?? null

// Explicit contract between Sector Nine catalog IDs and GoldSrc engine map names.
const hl1MapNames:Record<string,string>={
  dm_crossfire:'crossfire',dm_bounce:'bounce',dm_undertow:'undertow',dm_gasworks:'gasworks',
  dm_boot_camp:'boot_camp',dm_datacore:'datacore',dm_lockdown:'lockdown',dm_rapidcore:'rapidcore',
  dm_stalkyard:'stalkyard',dm_lambda_bunker:'lambda_bunker',dm_frenzy:'frenzy',dm_killbox:'killbox',
  dm_subtransit:'subtransit',dm_powerhouse:'powerhouse',dm_rust:'rust',dm_snark_pit:'snark_pit',
  dm_stretch:'stretch',dm_desert:'desert',dm_industrial:'industrial',dm_fortress:'fortress',
}
export const hl1EngineMapName = (canonicalMap: string): string | null => hl1MapNames[canonicalMap]??null
