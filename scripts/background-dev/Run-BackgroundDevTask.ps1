param([Parameter(Mandatory=$true)][string]$QueueId)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BackgroundDev.Common.ps1')
Initialize-BackgroundDevStorage
$config = Read-BackgroundDevJson $script:BackgroundDevConfig $null

$item = Invoke-BackgroundDevLocked 'queue' {
  $queueDocument = Read-BackgroundDevCollection $script:BackgroundDevQueue
  $queue = @($queueDocument.items)
  $currentItem = $queue | Where-Object { $_.id -eq $QueueId } | Select-Object -First 1
  if ($null -eq $currentItem) { throw "Unknown queued task $QueueId." }
  Set-BackgroundDevProperty $currentItem 'status' 'running'
  Set-BackgroundDevProperty $currentItem 'startedAt' ([DateTime]::UtcNow.ToString('o'))
  Write-BackgroundDevCollection $script:BackgroundDevQueue $queue
  $currentItem
}
$taskProperty = $config.tasks.PSObject.Properties[[string]$item.taskId]
if ($null -eq $taskProperty) { throw "Unknown task definition $($item.taskId)." }
$task = $taskProperty.Value
$stdout = Join-Path $script:BackgroundDevLogs ("$QueueId.out.log")
$stderr = Join-Path $script:BackgroundDevLogs ("$QueueId.err.log")
Invoke-BackgroundDevLocked 'queue' {
  $queueDocument = Read-BackgroundDevCollection $script:BackgroundDevQueue
  $queue = @($queueDocument.items)
  $current = $queue | Where-Object { $_.id -eq $QueueId } | Select-Object -First 1
  if ($null -ne $current) {
    Set-BackgroundDevProperty $current 'stdout' $stdout
    Set-BackgroundDevProperty $current 'stderr' $stderr
  }
  Write-BackgroundDevCollection $script:BackgroundDevQueue $queue
}
$process = Start-Process -FilePath ([string]$task.executable) -ArgumentList @($task.arguments) -WorkingDirectory ([string]$task.workingDirectory) -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
try { $process.PriorityClass = 'BelowNormal' } catch {}
Invoke-BackgroundDevLocked 'workers' {
  $workers = @(Get-BackgroundDevWorkers)
  $workers += [pscustomobject]@{ pid = $process.Id; processStartTimeUtc = $process.StartTime.ToUniversalTime().ToString('o'); queueId = $QueueId; taskId = [string]$item.taskId; name = [string]$task.name; class = [string]$task.class; critical = $false; startedAt = [DateTime]::UtcNow.ToString('o') }
  Write-BackgroundDevCollection $script:BackgroundDevWorkers $workers
}
$process.WaitForExit()
$process.Refresh()
$exitCode = [int]$process.ExitCode
Invoke-BackgroundDevLocked 'workers' { Write-BackgroundDevCollection $script:BackgroundDevWorkers @(Get-BackgroundDevWorkers | Where-Object { [int]$_.pid -ne $process.Id }) }
Invoke-BackgroundDevLocked 'queue' {
  $queueDocument = Read-BackgroundDevCollection $script:BackgroundDevQueue
  $queue = @($queueDocument.items)
  $current = $queue | Where-Object { $_.id -eq $QueueId } | Select-Object -First 1
  if ($null -ne $current) {
    Set-BackgroundDevProperty $current 'status' $(if ($exitCode -eq 0) { 'completed' } else { 'failed' })
    Set-BackgroundDevProperty $current 'exitCode' $exitCode
    Set-BackgroundDevProperty $current 'finishedAt' ([DateTime]::UtcNow.ToString('o'))
  }
  Write-BackgroundDevCollection $script:BackgroundDevQueue $queue
}
exit $exitCode
