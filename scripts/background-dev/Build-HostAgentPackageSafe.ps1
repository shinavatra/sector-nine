$ErrorActionPreference = 'Stop'
$agentRoot = 'D:\keshaaa\sector-nine-host-agent'
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $agentRoot 'release'))
$zip = [IO.Path]::GetFullPath((Join-Path $releaseRoot 'SectorNine-Host-Agent-Windows-x64.zip'))
if (-not $zip.StartsWith($releaseRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe Host Agent release path.' }
if (Test-Path -LiteralPath $zip) {
  $hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
  $stamp = (Get-Item -LiteralPath $zip).LastWriteTimeUtc.ToString('yyyyMMdd-HHmmss')
  $backup = Join-Path $releaseRoot ("SectorNine-Host-Agent-Windows-x64.backup-$stamp-$($hash.Substring(0,12)).zip")
  if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $zip -Destination $backup }
}
Push-Location $agentRoot
try {
  & npm.cmd run package:windows
  if ($LASTEXITCODE -ne 0) { throw "Host Agent packaging failed with exit code $LASTEXITCODE." }
} finally { Pop-Location }
