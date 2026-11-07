$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location -LiteralPath $projectRoot

$playwrightPackage = Join-Path $projectRoot 'node_modules\@playwright\test\package.json'
if (-not (Test-Path -LiteralPath $playwrightPackage)) {
  & npm.cmd install --save-dev '@playwright/test'
  if ($LASTEXITCODE -ne 0) { throw "Playwright package installation failed with exit code $LASTEXITCODE" }
}

& npx.cmd playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "Playwright Chromium installation failed with exit code $LASTEXITCODE" }

& npx.cmd playwright --version
if ($LASTEXITCODE -ne 0) { throw "Playwright verification failed with exit code $LASTEXITCODE" }
