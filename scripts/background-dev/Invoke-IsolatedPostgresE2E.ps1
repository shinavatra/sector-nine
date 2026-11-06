$ErrorActionPreference = 'Stop'
$postgresBin = 'C:\Program Files\PostgreSQL\18\bin'
$required = @('initdb.exe','pg_ctl.exe','createdb.exe')
foreach ($name in $required) { if (-not (Test-Path -LiteralPath (Join-Path $postgresBin $name))) { throw "Local PostgreSQL 18 tool is unavailable: $name" } }
$testRoot = Join-Path $env:TEMP ('sector-nine-pg-e2e-' + [guid]::NewGuid().ToString('N'))
$dataRoot = Join-Path $testRoot 'data'
$serverStarted = $false
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
  & (Join-Path $postgresBin 'initdb.exe') -D $dataRoot -U postgres -A trust --no-locale --encoding=UTF8
  if ($LASTEXITCODE -ne 0) { throw 'Disposable PostgreSQL initialization failed.' }
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  $listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
  & (Join-Path $postgresBin 'pg_ctl.exe') -D $dataRoot -l (Join-Path $testRoot 'postgres.log') -o "-h 127.0.0.1 -p $port" start
  if ($LASTEXITCODE -ne 0) { throw 'Disposable PostgreSQL startup failed.' }
  $serverStarted = $true
  & (Join-Path $postgresBin 'createdb.exe') -h 127.0.0.1 -p $port -U postgres sector_nine_e2e
  if ($LASTEXITCODE -ne 0) { throw 'Disposable PostgreSQL database creation failed.' }
  $testUrl = "postgresql://postgres@127.0.0.1:$port/sector_nine_e2e"
  Push-Location 'D:\keshaaa\sector_nine_final'
  try {
    $env:DATABASE_URL = $testUrl
    $env:TEST_DATABASE_URL = $testUrl
    & npm.cmd run db:migrate; if ($LASTEXITCODE -ne 0) { throw 'Test migrations failed.' }
    $signatureRoot = Join-Path $env:LOCALAPPDATA 'SectorNine\BackgroundDev'
    $signaturePath = Join-Path $signatureRoot 'expected-schema-through-052.json'
    & node scripts/export-schema-signature.mjs --normalize-through-052 "--output=$signaturePath"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $signaturePath)) { throw 'Expected schema signature export failed.' }
    & npm.cmd run test:friends-party:e2e; if ($LASTEXITCODE -ne 0) { throw 'Friends/party PostgreSQL E2E failed.' }
    & npm.cmd run test:party-matchmaking:e2e; if ($LASTEXITCODE -ne 0) { throw 'Party/matchmaking PostgreSQL E2E failed.' }
  } finally {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
    Pop-Location
  }
} finally {
  if ($serverStarted) { & (Join-Path $postgresBin 'pg_ctl.exe') -D $dataRoot stop -m fast | Out-Null }
  $resolved = [IO.Path]::GetFullPath($testRoot)
  $allowedPrefix = [IO.Path]::GetFullPath((Join-Path $env:TEMP 'sector-nine-pg-e2e-'))
  if ($resolved.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath (Join-Path $dataRoot 'PG_VERSION'))) {
    [IO.Directory]::Delete($resolved, $true)
  } else { Write-Warning "Disposable PostgreSQL directory was not removed because its safety markers were not verified: $resolved" }
}
