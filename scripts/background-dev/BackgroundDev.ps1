param(
  [Parameter(Position=0)][ValidateSet('AUTO','GAMING','FORCE_GAMING','IDLE','FORCE_IDLE','PAUSE','PAUSE_ALL_DEVELOPMENT','RESUME','RESUME_DEVELOPMENT','STATUS','LIST','QUEUE','JOB','WAIT')][string]$Command = 'STATUS',
  [Parameter(Position=1)][string]$TaskId,
  [Parameter(Position=2)][ValidateRange(1,86400)][int]$TimeoutSeconds = 3600
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BackgroundDev.Common.ps1')
Initialize-BackgroundDevStorage
if ($Command -eq 'FORCE_GAMING') { $Command = 'GAMING' }
if ($Command -eq 'FORCE_IDLE') { $Command = 'IDLE' }
if ($Command -eq 'PAUSE_ALL_DEVELOPMENT') { $Command = 'PAUSE' }
if ($Command -eq 'RESUME_DEVELOPMENT') { $Command = 'RESUME' }

switch ($Command) {
  'AUTO' { Write-BackgroundDevJson $script:BackgroundDevControl ([ordered]@{ mode = 'AUTO'; updatedAt = [DateTime]::UtcNow.ToString('o') }); 'Automatic mode enabled.' }
  'GAMING' { Write-BackgroundDevJson $script:BackgroundDevControl ([ordered]@{ mode = 'FORCE_GAMING'; updatedAt = [DateTime]::UtcNow.ToString('o') }); 'Gaming mode forced.' }
  'IDLE' { Write-BackgroundDevJson $script:BackgroundDevControl ([ordered]@{ mode = 'FORCE_IDLE'; updatedAt = [DateTime]::UtcNow.ToString('o') }); 'Idle mode forced.' }
  'PAUSE' { Write-BackgroundDevJson $script:BackgroundDevControl ([ordered]@{ mode = 'PAUSE'; updatedAt = [DateTime]::UtcNow.ToString('o') }); 'All new development work paused; owned running workers remain intact at low priority.' }
  'RESUME' { Write-BackgroundDevJson $script:BackgroundDevControl ([ordered]@{ mode = 'AUTO'; updatedAt = [DateTime]::UtcNow.ToString('o') }); 'Development resumed in automatic mode.' }
  'QUEUE' {
    if ([string]::IsNullOrWhiteSpace($TaskId)) { throw 'QUEUE requires a configured task ID.' }
    $config = Read-BackgroundDevJson $script:BackgroundDevConfig $null
    if ($null -eq $config.tasks.PSObject.Properties[$TaskId]) { throw "Task '$TaskId' is not allowlisted." }
    $queueId = [guid]::NewGuid().ToString('N')
    Invoke-BackgroundDevLocked 'queue' {
      $queueDocument = Read-BackgroundDevCollection $script:BackgroundDevQueue
      $queue = @($queueDocument.items)
      $queue += [pscustomobject]@{ id = $queueId; taskId = $TaskId; status = 'queued'; queuedAt = [DateTime]::UtcNow.ToString('o') }
      Write-BackgroundDevCollection $script:BackgroundDevQueue $queue
    }
    "Queued $TaskId as $queueId."
  }
  'LIST' {
    $config = Read-BackgroundDevJson $script:BackgroundDevConfig $null
    foreach ($property in $config.tasks.PSObject.Properties | Sort-Object Name) {
      "{0,-34} {1}" -f $property.Name, $property.Value.name
    }
  }
  'JOB' {
    if ([string]::IsNullOrWhiteSpace($TaskId)) { throw 'JOB requires a queue ID.' }
    $job = @((Read-BackgroundDevCollection $script:BackgroundDevQueue).items) | Where-Object id -eq $TaskId | Select-Object -First 1
    if ($null -eq $job) { throw "Unknown queue ID '$TaskId'." }
    $job | ConvertTo-Json -Depth 5
  }
  'WAIT' {
    if ([string]::IsNullOrWhiteSpace($TaskId)) { throw 'WAIT requires a queue ID.' }
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
      $job = @((Read-BackgroundDevCollection $script:BackgroundDevQueue).items) | Where-Object id -eq $TaskId | Select-Object -First 1
      if ($null -eq $job) { throw "Unknown queue ID '$TaskId'." }
      if ($job.status -in @('completed','failed','invalid')) { break }
      Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($job.status -notin @('completed','failed','invalid')) { throw "Timed out waiting for '$TaskId'; current status is '$($job.status)'." }
    $job | ConvertTo-Json -Depth 5
    if ($job.status -ne 'completed') { exit 1 }
  }
  'STATUS' {
    $state = Read-BackgroundDevJson $script:BackgroundDevState $null
    if ($null -eq $state) { 'Controller has not published state yet.'; break }
    "Mode: $($state.mode) (override: $($state.override))"
    "Reason: $($state.reason)"
    "Foreground: $($state.foreground.process) (fullscreen: $($state.foreground.fullscreen))"
    "System: CPU $($state.system.cpuPercent)% | RAM used $($state.system.usedMemoryMb) MB | available $($state.system.availableMemoryMb) MB | GPU $($state.system.gpuPercent)%"
    "Development: $($state.development.activeWorkers) workers | $($state.development.workingSetMb) MB | deferred $($state.development.deferredTasks)"
    if ($state.development.activeTasks.Count -gt 0) { "Active tasks: $($state.development.activeTasks -join ', ')" }
    "Updated: $($state.timestamp)"
  }
}
