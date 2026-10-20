import { hl1EngineMapName, trustedHl1Rules } from './hl1MatchContract'
import type { HostAgentPlayer, HostAgentStats } from './hostAgentProtocol'

export type TrustedMatchAssignment = {
  id: string
  game_id: string
  game_mode: string
  selected_map: string | null
  player1_id: string
  player2_id: string
  player1_steam_id: string | null
  player2_steam_id: string | null
}

export class TrustedMatchResultError extends Error {
  constructor(public code: string, message: string, public status = 409) {
    super(message)
  }
}

const steamId64Base = 76561197960265728n

export const steamAccountId = (value: string): bigint | null => {
  const text = String(value || '').trim()
  if (/^7656119\d{10}$/.test(text)) {
    const id = BigInt(text)
    return id >= steamId64Base ? id - steamId64Base : null
  }
  const steam2 = text.match(/^STEAM_[0-5]:([01]):(\d{1,20})$/)
  if (steam2) return BigInt(steam2[2]) * 2n + BigInt(steam2[1])
  const steam3 = text.match(/^\[U:1:(\d{1,20})\]$/)
  return steam3 ? BigInt(steam3[1]) : null
}

const normalizedMap = (value: string | null) => String(value || '').trim().toLowerCase().replace(/^maps[\\/]/, '').replace(/\.bsp$/, '')

export const validateTrustedMatchContext = (
  assignment: TrustedMatchAssignment,
  report: { players: HostAgentPlayer[]; playerCount: number; map: string | null },
) => {
  if (assignment.game_id !== 'hl1') {
    throw new TrustedMatchResultError('UNSUPPORTED_ASSIGNED_GAME', 'Trusted result validation only supports assigned HL1 matches')
  }
  if (!trustedHl1Rules(assignment.game_mode)) {
    throw new TrustedMatchResultError('UNSUPPORTED_ASSIGNED_MODE', 'Assigned HL1 mode has no trusted completion rules')
  }
  const expectedMap = assignment.selected_map ? hl1EngineMapName(assignment.selected_map) : null
  if (!expectedMap || !report.map || normalizedMap(report.map) !== normalizedMap(expectedMap)) {
    throw new TrustedMatchResultError('ASSIGNED_MAP_MISMATCH', 'Reported map does not match the assigned match map')
  }

  const expected = [assignment.player1_steam_id, assignment.player2_steam_id].map(value => value ? steamAccountId(value) : null)
  if (expected.some(value => value === null) || expected[0] === expected[1]) {
    throw new TrustedMatchResultError('INCOMPLETE_MATCH_ASSIGNMENT', 'Assigned match has incomplete or conflicting Steam identities')
  }
  const reported = report.players.map(player => steamAccountId(player.steamId))
  if (reported.some(value => value === null) || new Set(reported.map(String)).size !== reported.length) {
    throw new TrustedMatchResultError('INVALID_REPORTED_PLAYERS', 'Reported players contain invalid or duplicate Steam identities')
  }
  if (report.playerCount !== 2 || reported.length !== 2 || !expected.every(value => reported.some(candidate => candidate === value))) {
    throw new TrustedMatchResultError('ASSIGNED_PLAYERS_MISMATCH', 'Reported players do not exactly match the assigned match players')
  }
}

export const validateTrustedMatchCompletion = (
  assignment: TrustedMatchAssignment,
  report: { players: HostAgentPlayer[]; playerCount: number; map: string | null; winnerId: string; stats: HostAgentStats },
) => {
  validateTrustedMatchContext(assignment, report)
  const rules = trustedHl1Rules(assignment.game_mode)!
  const p1 = report.stats.score_p1
  const p2 = report.stats.score_p2
  if (p1 === p2) throw new TrustedMatchResultError('CONTRADICTORY_MATCH_RESULT', 'A completed match cannot have a tied score')
  const winningScore = Math.max(p1, p2)
  const losingScore = Math.min(p1, p2)
  if (winningScore < rules.fragLimit) {
    throw new TrustedMatchResultError('INCOMPLETE_MATCH_RESULT', `Winning score has not reached the ${rules.fragLimit} frag limit`)
  }
  if (losingScore >= rules.fragLimit) {
    throw new TrustedMatchResultError('CONTRADICTORY_MATCH_RESULT', 'Both players cannot have reached the frag limit in the same completed match')
  }
  const winnerId = p1 > p2 ? assignment.player1_id : assignment.player2_id
  if (report.winnerId !== winnerId) {
    throw new TrustedMatchResultError('CONTRADICTORY_MATCH_RESULT', 'Reported winner contradicts the validated score')
  }
  return { winnerId, stats: report.stats }
}
