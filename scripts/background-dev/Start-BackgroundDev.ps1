param([switch]$InstallLogonTask)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BackgroundDev.Common.ps1')
Initialize-BackgroundDevStorage
$controller = (Resolve-Path (Join-Path $PSScriptRoot 'BackgroundDev.Controller.ps1')).Path
$pidPath = Join-Path $script:BackgroundDevRoot 'controller.pid'
$running = $false
if (Test-Path -LiteralPath $pidPath) {
  $existingPid = 0
  $pidText = Get-Content -LiteralPath $pidPath -Raw
  if (-not [string]::IsNullOrWhiteSpace($pidText)) { [void][int]::TryParse($pidText.Trim(), [ref]$existingPid) }
  if ($existingPid -gt 0) { try { $null = Get-Process -Id $existingPid -ErrorAction Stop; $running = $true } catch {} }
}
if (-not $running) {
  $controllerOut = Join-Path $script:BackgroundDevLogs 'controller.out.log'
  $controllerErr = Join-Path $script:BackgroundDevLogs 'controller.err.log'
  $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',$controller) -WindowStyle Hidden -RedirectStandardOutput $controllerOut -RedirectStandardError $controllerErr -PassThru
  try { $process.PriorityClass = 'BelowNormal' } catch {}
  "Controller started with PID $($process.Id)."
} else { "Controller already running with PID $existingPid." }

if ($InstallLogonTask) {
  $taskName = 'SectorNineBackgroundDeveloper'
  $argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$controller`""
  $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($null -ne $existing) {
    $existingCommand = [string]$existing.Actions.Execute
    $existingArguments = [string]$existing.Actions.Arguments
    if ($existingCommand -notmatch 'powershell' -or $existingArguments -notlike "*$controller*") { throw "Scheduled task '$taskName' exists but is not owned by this workflow." }
  }
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Low-impact Sector Nine development resource controller.' -Force | Out-Null
  "Logon task '$taskName' installed for $env:USERNAME."
}
