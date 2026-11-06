$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BackgroundDev.Common.ps1')
$config = Read-BackgroundDevJson $script:BackgroundDevConfig $null
$passed = 0
function Assert-Equal($Actual, $Expected, [string]$Name) { if ($Actual -ne $Expected) { throw "$Name expected '$Expected', got '$Actual'." }; $script:passed++ }
function New-Runtime { [pscustomobject]@{ GamingUntil = [DateTime]::MinValue; IdleSamples = 0 } }
function New-Input([hashtable]$Values) {
  $base = @{ Override='AUTO';GameCount=0;GameNames=@();ForegroundProcess='explorer';Fullscreen=$false;IdleSeconds=0;CpuPercent=10;AvailableMemoryMb=8000;GpuPercent=10 }
  foreach ($key in $Values.Keys) { $base[$key] = $Values[$key] }
  [pscustomobject]$base
}
$mode = Resolve-BackgroundDevMode (New-Input @{GameCount=1;GameNames=@('SafeGame')}) $config (New-Runtime)
Assert-Equal $mode.Mode 'GAMING' 'game transition'
$runtime = New-Runtime; $runtime.GamingUntil = [DateTime]::UtcNow.AddSeconds(10)
Assert-Equal (Resolve-BackgroundDevMode (New-Input @{}) $config $runtime).Mode 'GAMING' 'gaming cooldown'
Assert-Equal (Resolve-BackgroundDevMode (New-Input @{CpuPercent=95;ForegroundProcess='ForegroundApp'}) $config (New-Runtime)).Mode 'GAMING' 'pressure protection'
Assert-Equal (Resolve-BackgroundDevMode (New-Input @{Override='PAUSE'}) $config (New-Runtime)).Mode 'PAUSED' 'pause override'
Assert-Equal (Resolve-BackgroundDevMode (New-Input @{Override='FORCE_IDLE'}) $config (New-Runtime)).Mode 'IDLE' 'idle override'
$idleRuntime = New-Runtime
for ($index=1; $index -le [int]$config.idleStableSamples; $index++) { $idleMode = Resolve-BackgroundDevMode (New-Input @{IdleSeconds=1200}) $config $idleRuntime }
Assert-Equal $idleMode.Mode 'IDLE' 'stable idle transition'
$before = Get-BackgroundDevForeground
& (Join-Path $PSScriptRoot 'BackgroundDev.Controller.ps1') -Once
$after = Get-BackgroundDevForeground
Assert-Equal $after.Handle $before.Handle 'foreground focus preservation'
$unrelated = Get-Process -Id $PID
$priority = $unrelated.PriorityClass
Set-BackgroundDevWorkerPriorities 'GAMING'
Assert-Equal (Get-Process -Id $PID).PriorityClass $priority 'unrelated process priority'
$controllerSource = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'BackgroundDev.Controller.ps1') -Raw
$runnerSource = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Run-BackgroundDevTask.ps1') -Raw
Assert-Equal ([bool]($controllerSource -notmatch 'Stop-Process|Suspend-Process')) $true 'controller never terminates or suspends workers'
Assert-Equal ([bool]($runnerSource -notmatch 'Stop-Process|Suspend-Process')) $true 'runner never terminates or suspends workers'
Assert-Equal ([int]$config.maxIdleHeavyWorkers) 1 'heavy jobs run sequentially'
foreach ($taskId in @('frontend-build','backend-build','matchmaking-tests','host-agent-protocol-tests','sector-nine-unit-tests','sector-nine-integration-tests','host-agent-build','host-agent-typecheck','host-agent-tests','host-agent-package','postgres-e2e','postgres-schema-rehearsal')) {
  Assert-Equal ($null -ne $config.tasks.PSObject.Properties[$taskId]) $true "allowlisted task $taskId"
}
$package = Get-Content -Raw -LiteralPath (Join-Path (Split-Path $PSScriptRoot -Parent | Split-Path -Parent) 'package.json') | ConvertFrom-Json
foreach ($command in @('bg:status','bg:list','bg:queue','bg:job','bg:wait')) {
  Assert-Equal ($null -ne $package.scripts.PSObject.Properties[$command]) $true "npm command $command"
}
"Background development tests: PASS ($passed assertions)"
