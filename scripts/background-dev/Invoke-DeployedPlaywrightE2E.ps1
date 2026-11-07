$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location -LiteralPath $projectRoot

$statusText = (& npx.cmd --yes '@railway/cli' status --json | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($statusText)) {
  throw 'Unable to read the linked Railway environment.'
}

$status = $statusText | ConvertFrom-Json
if ($status.name -ne 'extraordinary-nature') {
  throw "Refusing browser E2E for unexpected Railway project '$($status.name)'."
}

$environment = @($status.environments.edges | ForEach-Object { $_.node }) | Where-Object { $_.name -eq 'production' } | Select-Object -First 1
if (-not $environment) { throw 'The linked Railway production test environment was not found.' }

$services = @($environment.serviceInstances.edges | ForEach-Object { $_.node })
$frontend = $services | Where-Object { $_.serviceName -eq 'sector-nine' } | Select-Object -First 1
$backend = $services | Where-Object { $_.serviceName -eq 'sector-nine-api' } | Select-Object -First 1
if (-not $frontend -or -not $backend) { throw 'The expected Sector Nine frontend/backend Railway services were not found.' }

$frontendDomain = @($frontend.domains.serviceDomains)[0].domain
$backendDomain = @($backend.domains.serviceDomains)[0].domain
if (-not $frontendDomain -or -not $backendDomain) { throw 'The deployed Railway service domains are unavailable.' }

$frontendDeployment = $frontend.latestDeployment
$backendDeployment = $backend.latestDeployment
if ($frontendDeployment.status -ne 'SUCCESS' -or $backendDeployment.status -ne 'SUCCESS') {
  throw 'The linked Railway frontend/backend deployment is not healthy enough for browser E2E.'
}

$frontendCommit = [string]$frontendDeployment.meta.commitHash
$backendCommit = [string]$backendDeployment.meta.commitHash
if ([string]::IsNullOrWhiteSpace($frontendCommit) -or $frontendCommit -ne $backendCommit) {
  throw 'The deployed frontend and backend revisions do not match.'
}

$env:PLAYWRIGHT_BASE_URL = "https://$frontendDomain"
$env:SECTOR_NINE_BACKEND_URL = "https://$backendDomain"
$env:SECTOR_NINE_DEPLOYED_COMMIT = $frontendCommit

& npm.cmd run test:browser:e2e
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
