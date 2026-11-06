param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('unit','integration')]
  [string]$Suite
)
$ErrorActionPreference = 'Stop'

$commands = if ($Suite -eq 'unit') {
  @(
    'test:steam-auth',
    'test:account-game-store',
    'test:game-server-mode',
    'test:game-server-endpoints',
    'test:retro-profile',
    'test:xp-progress',
    'test:friends-social',
    'test:party-polling',
    'test:friends-party',
    'test:secure-comms-realtime',
    'test:player-presence',
    'test:ui-admin-settings'
  )
} else {
  @(
    'test:secure-sessions',
    'test:host-agent',
    'test:trusted-match-results',
    'test:competitive-result-security',
    'test:host-agent-events',
    'test:hl1-assignment',
    'test:hl1-lifecycle',
    'test:live-match-dashboard',
    'test:party-matchmaking',
    'test:live-server-browser',
    'test:host-pairing'
  )
}

foreach ($command in $commands) {
  Write-Output "Running npm run $command"
  & npm.cmd run $command
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
