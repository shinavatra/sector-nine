param([switch]$Once)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BackgroundDev.Common.ps1')
Initialize-BackgroundDevStorage

$config = Read-BackgroundDevJson $script:BackgroundDevConfig $null
if ($null -eq $config) { throw 'Background development configuration is unavailable.' }
$controllerMutex = [Threading.Mutex]::new($false, 'Local\SectorNineBackgroundDev-Controller')
$controllerLock = $controllerMutex.WaitOne(0)
if (-not $controllerLock) { $controllerMutex.Dispose(); exit 0 }
$runtime = [pscustomobject]@{ GamingUntil = [DateTime]::MinValue; IdleSamples = 0; Poll = 0; LastGpuPercent = $null }
$controllerPidPath = Join-Path $script:BackgroundDevRoot 'controller.pid'
Set-Content -LiteralPath $controllerPidPath -Value $PID -Encoding ASCII

function Start-QueuedBackgroundTasks([string]$Mode) {
  if ($Mode -eq 'GAMING' -or $Mode -eq 'PAUSED') { return }
  Invoke-BackgroundDevLocked 'queue' {
    $queueDocument = Read-BackgroundDevCollection $script:BackgroundDevQueue
    $queue = @($queueDocument.items)
    $changed = $false
    foreach ($recoverable in @($queue | Where-Object { $_.status -in @('starting','running') })) {
      $runnerAlive = $false
      if ($null -ne $recoverable.PSObject.Properties['runnerPid'] -and $null -ne $recoverable.PSObject.Properties['runnerStartTimeUtc']) {
        try {
          $runner = Get-Process -Id ([int]$recoverable.runnerPid) -ErrorAction Stop
          $expectedStart = [DateTime]::Parse([string]$recoverable.runnerStartTimeUtc).ToUniversalTime()
          $runnerAlive = [Math]::Abs(($runner.StartTime.ToUniversalTime() - $expectedStart).TotalSeconds) -lt 1
        } catch {}
      }
      if (-not $runnerAlive) { Set-BackgroundDevProperty $recoverable 'status' 'queued'; $changed = $true }
    }
    $workers = @(Get-BackgroundDevWorkers)
    $heavyCount = @($workers | Where-Object { $_.class -eq 'heavy' }).Count
    foreach ($item in @($queue | Where-Object { $_.status -eq 'queued' } | Sort-Object queuedAt)) {
      $taskProperty = $config.tasks.PSObject.Properties[[string]$item.taskId]
      if ($null -eq $taskProperty) { Set-BackgroundDevProperty $item 'status' 'invalid'; Set-BackgroundDevProperty $item 'finishedAt' ([DateTime]::UtcNow.ToString('o')); $changed = $true; continue }
      $task = $taskProperty.Value
      if ([bool]$task.idleOnly -and $Mode -ne 'IDLE') { continue }
      if ($task.class -eq 'heavy' -and $heavyCount -ge [int]$config.maxIdleHeavyWorkers) { continue }
      $runner = Join-Path $PSScriptRoot 'Run-BackgroundDevTask.ps1'
      $runnerOut = Join-Path $script:BackgroundDevLogs ("runner-$($item.id).out.log")
      $runnerErr = Join-Path $script:BackgroundDevLogs ("runner-$($item.id).err.log")
      $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$runner,'-QueueId',[string]$item.id) -WindowStyle Hidden -RedirectStandardOutput $runnerOut -RedirectStandardError $runnerErr -PassThru
      try { $process.PriorityClass = 'BelowNormal' } catch {}
      Set-BackgroundDevProperty $item 'status' 'starting'
      Set-BackgroundDevProperty $item 'runnerPid' $process.Id
      Set-BackgroundDevProperty $item 'runnerStartTimeUtc' ($process.StartTime.ToUniversalTime().ToString('o'))
      Set-BackgroundDevProperty $item 'startedAt' ([DateTime]::UtcNow.ToString('o'))
      if ($task.class -eq 'heavy') { $heavyCount++ }
      $changed = $true
    }
    if ($changed) { Write-BackgroundDevCollection $script:BackgroundDevQueue $queue }
  }
}

try {
  do {
    $runtime.Poll++
    $config = Read-BackgroundDevJson $script:BackgroundDevConfig $config
    $control = Read-BackgroundDevJson $script:BackgroundDevControl ([pscustomobject]@{ mode = 'AUTO' })
    $foreground = Get-BackgroundDevForeground
    $metrics = Get-BackgroundDevSystemMetrics (($runtime.Poll % 9) -eq 1)
    if ($null -ne $metrics.GpuPercent) { $runtime.LastGpuPercent = $metrics.GpuPercent }
    else { $metrics.GpuPercent = $runtime.LastGpuPercent }
    $games = @(Get-BackgroundDevGameProcesses $config)
    $inputState = [pscustomobject]@{
      Override = [string]$control.mode
      GameCount = $games.Count
      GameNames = @($games | ForEach-Object { $_.Name })
      ForegroundProcess = $foreground.ProcessName
      Fullscreen = $foreground.Fullscreen
      IdleSeconds = Get-BackgroundDevIdleSeconds
      CpuPercent = $metrics.CpuPercent
      AvailableMemoryMb = $metrics.AvailableMemoryMb
      GpuPercent = $metrics.GpuPercent
    }
    $decision = Resolve-BackgroundDevMode $inputState $config $runtime
    Set-BackgroundDevWorkerPriorities $decision.Mode
    Start-QueuedBackgroundTasks $decision.Mode
    $workers = @(Get-BackgroundDevWorkers)
    $queueDocument = Read-BackgroundDevCollection $script:BackgroundDevQueue
    $queue = @($queueDocument.items)
    $ownedCpu = 0.0; $ownedRam = 0.0
    foreach ($worker in $workers) { try { $p = Get-Process -Id ([int]$worker.pid) -ErrorAction Stop; $ownedCpu += [double]$p.CPU; $ownedRam += [double]$p.WorkingSet64 / 1MB } catch {} }
    $state = [ordered]@{
      timestamp = [DateTime]::UtcNow.ToString('o'); controllerPid = $PID; mode = $decision.Mode; override = [string]$control.mode
      reason = $decision.Reason; pollSeconds = [int]$config.pollSeconds; idleSeconds = $inputState.IdleSeconds
      foreground = [ordered]@{ process = $foreground.ProcessName; pid = $foreground.Pid; fullscreen = $foreground.Fullscreen }
      games = $games; system = [ordered]@{ cpuPercent = $metrics.CpuPercent; availableMemoryMb = $metrics.AvailableMemoryMb; usedMemoryMb = $metrics.UsedMemoryMb; gpuPercent = $metrics.GpuPercent }
      development = [ordered]@{ activeWorkers = $workers.Count; activeTasks = @($workers | ForEach-Object { $_.name }); cpuSeconds = [Math]::Round($ownedCpu, 2); workingSetMb = [Math]::Round($ownedRam, 1); deferredTasks = @($queue | Where-Object { $_.status -eq 'queued' }).Count }
    }
    Write-BackgroundDevJson $script:BackgroundDevState $state
    if (-not $Once) { Start-Sleep -Seconds ([int]$config.pollSeconds) }
  } while (-not $Once)
} finally {
  if (Test-Path -LiteralPath $controllerPidPath) {
    $recorded = (Get-Content -LiteralPath $controllerPidPath -Raw).Trim()
    if ($recorded -eq [string]$PID) { Clear-Content -LiteralPath $controllerPidPath }
  }
  if ($controllerLock) { $controllerMutex.ReleaseMutex() }
  $controllerMutex.Dispose()
}
