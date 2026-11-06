$ErrorActionPreference = 'Stop'
$postgresBin = 'C:\Program Files\PostgreSQL\18\bin'
$backupRoot = Join-Path $env:LOCALAPPDATA 'SectorNine\Backups'
$backup = Get-ChildItem $backupRoot -Filter '*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $backup) { throw 'No verified Railway backup is available for rehearsal.' }

$testRoot = Join-Path $env:TEMP ('sector-nine-schema-rehearsal-' + [guid]::NewGuid().ToString('N'))
$dataRoot = Join-Path $testRoot 'data'
$reportRoot = Join-Path $env:LOCALAPPDATA 'SectorNine\BackgroundDev'
$referenceSignature = Join-Path $testRoot 'reference-final.json'
$reference052Signature = Join-Path $testRoot 'reference-through-052.json'
$restoredPreSignature = Join-Path $testRoot 'restored-before-reconciliation.json'
$restoredSignature = Join-Path $testRoot 'restored-final.json'
$reportPath = Join-Path $reportRoot 'railway-schema-rehearsal.json'
$serverStarted = $false
$failure = $null
New-Item -ItemType Directory -Path $testRoot | Out-Null

function Invoke-Checked([string]$Executable,[string[]]$Arguments,[string]$Failure) {
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) { throw $Failure }
}

try {
  Invoke-Checked (Join-Path $postgresBin 'initdb.exe') @('-D',$dataRoot,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8') 'Disposable PostgreSQL initialization failed.'
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
  $listener.Start(); $port=$listener.LocalEndpoint.Port; $listener.Stop()
  Invoke-Checked (Join-Path $postgresBin 'pg_ctl.exe') @('-D',$dataRoot,'-l',(Join-Path $testRoot 'postgres.log'),'-o',"-h 127.0.0.1 -p $port",'start') 'Disposable PostgreSQL startup failed.'
  $serverStarted=$true
  foreach($database in @('railway_restore','canonical_reference')) {
    Invoke-Checked (Join-Path $postgresBin 'createdb.exe') @('-h','127.0.0.1','-p',"$port",'-U','postgres',$database) "Failed to create $database."
  }
  Invoke-Checked (Join-Path $postgresBin 'pg_restore.exe') @('-h','127.0.0.1','-p',"$port",'-U','postgres','--dbname','railway_restore','--exit-on-error','--no-owner','--no-privileges',$backup.FullName) 'Backup restore failed.'

  Push-Location 'D:\keshaaa\sector_nine_final'
  try {
    $referenceUrl="postgresql://postgres@127.0.0.1:$port/canonical_reference"
    $restoredUrl="postgresql://postgres@127.0.0.1:$port/railway_restore"

    $env:DATABASE_URL=$referenceUrl
    Invoke-Checked 'node' @('scripts/migrate-postgres.mjs') 'Canonical migrations failed.'
    Invoke-Checked 'node' @('scripts/export-schema-signature.mjs',"--output=$referenceSignature") 'Canonical schema export failed.'
    Invoke-Checked 'node' @('scripts/export-schema-signature.mjs','--normalize-through-052',"--output=$reference052Signature") 'Canonical 001-052 schema export failed.'

    $env:DATABASE_URL=$restoredUrl
    Invoke-Checked 'node' @('scripts/export-schema-signature.mjs',"--output=$restoredPreSignature") 'Pre-reconciliation schema export failed.'
    $preComparisonRaw = & node scripts/compare-schema-signatures.mjs $reference052Signature $restoredPreSignature
    $preComparison = $preComparisonRaw | ConvertFrom-Json
    $beforeCounts = & node scripts/verify-schema-reconciliation.mjs counts
    Invoke-Checked (Join-Path $postgresBin 'psql.exe') @($restoredUrl,'-v','ON_ERROR_STOP=1','-f','scripts/reconcile-schema-through-052.sql') 'Schema reconciliation failed on restored backup.'
    $env:MIGRATION_BASELINE_CONFIRM='BASELINE_EXISTING_SCHEMA'
    Invoke-Checked 'node' @('scripts/migrate-postgres.mjs','--baseline','--through=052_player_presence_leases.sql','--execute-baseline') 'Migration baseline rehearsal failed.'
    Remove-Item Env:MIGRATION_BASELINE_CONFIRM -ErrorAction SilentlyContinue
    Invoke-Checked 'node' @('scripts/migrate-postgres.mjs') 'Pending migration rehearsal failed.'
    Invoke-Checked 'node' @('scripts/export-schema-signature.mjs',"--output=$restoredSignature") 'Restored schema export failed.'
    & node scripts/compare-schema-signatures.mjs $referenceSignature $restoredSignature
    if ($LASTEXITCODE -ne 0) { throw 'Reconciled restore does not match canonical schema.' }

    $verification = & node scripts/verify-schema-reconciliation.mjs final | ConvertFrom-Json
    $before = $beforeCounts | ConvertFrom-Json
    $differences=@()
    foreach($property in $before.PSObject.Properties){if([int64]$property.Value -ne [int64]$verification.counts.($property.Name)){$differences += $property.Name}}
    if($differences.Count){throw "Record counts changed during rehearsal: $($differences -join ', ')"}
    if([int]$verification.checks.indexes -ne 6 -or $verification.checks.fk_action -ne 'n' -or -not $verification.checks.hl1_1v1 -or $verification.checks.hl1_2v2 -or $verification.checks.cs16){throw 'Rehearsal invariants failed.'}
    [pscustomobject]@{backupPath=$backup.FullName;backupBytes=$backup.Length;backupSha256=(Get-FileHash $backup.FullName -Algorithm SHA256).Hash.ToLowerInvariant();differencesBefore=$preComparison;schemaCompatible=$true;recordCountsPreserved=$true;ledger=$verification.ledger;checks=$verification.checks;completedAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding UTF8
    Get-Content $reportPath
  } finally {
    Remove-Item Env:DATABASE_URL,Env:MIGRATION_BASELINE_CONFIRM -ErrorAction SilentlyContinue
    Pop-Location
  }
} catch {
  $failure = $_
} finally {
  if($serverStarted){& (Join-Path $postgresBin 'pg_ctl.exe') -D $dataRoot stop -m fast | Out-Null}
  $resolved=[IO.Path]::GetFullPath($testRoot)
  $allowed=[IO.Path]::GetFullPath((Join-Path $env:TEMP 'sector-nine-schema-rehearsal-'))
  if($resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)-and(Test-Path -LiteralPath(Join-Path $dataRoot 'PG_VERSION'))){[IO.Directory]::Delete($resolved,$true)}
  else{Write-Warning "Rehearsal directory was retained because safety markers were not verified: $resolved"}
}
if($failure){[Console]::Error.WriteLine($failure.ToString());exit 1}
