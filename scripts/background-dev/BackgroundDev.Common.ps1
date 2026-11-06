Set-StrictMode -Version Latest

$script:BackgroundDevRoot = Join-Path $env:LOCALAPPDATA 'SectorNine\BackgroundDev'
$script:BackgroundDevConfig = Join-Path $PSScriptRoot 'config.json'
$script:BackgroundDevState = Join-Path $script:BackgroundDevRoot 'state.json'
$script:BackgroundDevControl = Join-Path $script:BackgroundDevRoot 'control.json'
$script:BackgroundDevQueue = Join-Path $script:BackgroundDevRoot 'queue.json'
$script:BackgroundDevWorkers = Join-Path $script:BackgroundDevRoot 'workers.json'
$script:BackgroundDevLogs = Join-Path $script:BackgroundDevRoot 'logs'

function Initialize-BackgroundDevStorage {
  New-Item -ItemType Directory -Force -Path $script:BackgroundDevRoot, $script:BackgroundDevLogs | Out-Null
  if (-not (Test-Path -LiteralPath $script:BackgroundDevControl)) { Write-BackgroundDevJson $script:BackgroundDevControl ([ordered]@{ mode = 'AUTO'; updatedAt = [DateTime]::UtcNow.ToString('o') }) }
  if (-not (Test-Path -LiteralPath $script:BackgroundDevQueue)) { Write-BackgroundDevCollection $script:BackgroundDevQueue @() }
  if (-not (Test-Path -LiteralPath $script:BackgroundDevWorkers)) { Write-BackgroundDevCollection $script:BackgroundDevWorkers @() }
}

function Read-BackgroundDevJson([string]$Path, $Fallback) {
  try {
    if (-not (Test-Path -LiteralPath $Path)) { return $Fallback }
    $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($raw)) { return $Fallback }
    return $raw | ConvertFrom-Json
  } catch { return $Fallback }
}

function Write-BackgroundDevJson([string]$Path, $Value) {
  $parent = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  $temporary = Join-Path $parent (([IO.Path]::GetFileName($Path)) + '.' + [guid]::NewGuid().ToString('N') + '.tmp')
  $json = ConvertTo-Json -InputObject $Value -Depth 12
  Set-Content -LiteralPath $temporary -Value $json -Encoding UTF8
  Move-Item -LiteralPath $temporary -Destination $Path -Force | Out-Null
}

function Set-BackgroundDevProperty($Object, [string]$Name, $Value) {
  if ($null -ne $Object.PSObject.Properties[$Name]) { $Object.$Name = $Value }
  else { $Object | Add-Member -MemberType NoteProperty -Name $Name -Value $Value }
}

function Read-BackgroundDevCollection([string]$Path) {
  $raw = Read-BackgroundDevJson $Path $null
  if ($null -eq $raw) { return [pscustomobject]@{ items = @() } }
  if ($null -ne $raw.PSObject.Properties['items']) { return [pscustomobject]@{ items = @($raw.items) } }
  if ($null -ne $raw.PSObject.Properties['value']) { return [pscustomobject]@{ items = @($raw.value) } }
  if ($raw -is [Array]) { return [pscustomobject]@{ items = @($raw) } }
  return [pscustomobject]@{ items = @($raw) }
}

function Write-BackgroundDevCollection([string]$Path, $Items) {
  $normalized = @()
  foreach ($item in @($Items)) {
    if ($null -eq $item) { continue }
    if ($item -is [Array]) { foreach ($nested in $item) { if ($null -ne $nested) { $normalized += $nested } } }
    else { $normalized += $item }
  }
  Write-BackgroundDevJson $Path ([ordered]@{ items = $normalized })
}

function Invoke-BackgroundDevLocked([string]$Name, [scriptblock]$Action) {
  $mutex = [Threading.Mutex]::new($false, "Local\SectorNineBackgroundDev-$Name")
  $locked = $false
  try {
    $locked = $mutex.WaitOne([TimeSpan]::FromSeconds(5))
    if (-not $locked) { throw "Timed out waiting for background development $Name lock." }
    & $Action
  } finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
  }
}

function Initialize-BackgroundDevNativeApi {
  if ('SectorNine.BackgroundDev.NativeMethods' -as [type]) { return }
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace SectorNine.BackgroundDev {
  public static class NativeMethods {
    [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
    [StructLayout(LayoutKind.Sequential)] public struct FILETIME { public uint Low; public uint High; }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)] public class MEMORYSTATUSEX {
      public uint Length = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX)); public uint MemoryLoad;
      public ulong TotalPhysical; public ulong AvailablePhysical; public ulong TotalPageFile; public ulong AvailablePageFile;
      public ulong TotalVirtual; public ulong AvailableVirtual; public ulong AvailableExtendedVirtual;
    }
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
    [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO value);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr handle, out RECT rect);
    [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr handle, uint flags);
    [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);
    [DllImport("kernel32.dll", SetLastError=true)] public static extern bool GetSystemTimes(out FILETIME idle, out FILETIME kernel, out FILETIME user);
    [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Auto)] public static extern bool GlobalMemoryStatusEx([In, Out] MEMORYSTATUSEX value);
  }
}
'@
}

function Get-BackgroundDevIdleSeconds {
  Initialize-BackgroundDevNativeApi
  $info = New-Object SectorNine.BackgroundDev.NativeMethods+LASTINPUTINFO
  $info.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($info)
  if (-not [SectorNine.BackgroundDev.NativeMethods]::GetLastInputInfo([ref]$info)) { return 0 }
  $currentTick = [uint32][Environment]::TickCount
  $elapsedTicks = if ($currentTick -ge $info.dwTime) { [uint64]($currentTick - $info.dwTime) } else { ([uint64][uint32]::MaxValue + 1 + $currentTick - $info.dwTime) }
  $elapsed = $elapsedTicks / 1000
  return [Math]::Max(0, [Math]::Round($elapsed, 1))
}

function Get-BackgroundDevForeground {
  Initialize-BackgroundDevNativeApi
  $handle = [SectorNine.BackgroundDev.NativeMethods]::GetForegroundWindow()
  if ($handle -eq [IntPtr]::Zero) { return [pscustomobject]@{ Handle = 0; Pid = 0; ProcessName = ''; Fullscreen = $false } }
  [uint32]$pidValue = 0
  [void][SectorNine.BackgroundDev.NativeMethods]::GetWindowThreadProcessId($handle, [ref]$pidValue)
  $name = ''
  try { $name = (Get-Process -Id $pidValue -ErrorAction Stop).ProcessName } catch {}
  $rect = New-Object SectorNine.BackgroundDev.NativeMethods+RECT
  $fullscreen = $false
  if ([SectorNine.BackgroundDev.NativeMethods]::GetWindowRect($handle, [ref]$rect)) {
    $monitor = [SectorNine.BackgroundDev.NativeMethods]::MonitorFromWindow($handle, 2)
    $monitorInfo = New-Object SectorNine.BackgroundDev.NativeMethods+MONITORINFO
    $monitorInfo.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($monitorInfo)
    if ([SectorNine.BackgroundDev.NativeMethods]::GetMonitorInfo($monitor, [ref]$monitorInfo)) {
      $tolerance = 2
      $fullscreen = ([Math]::Abs($rect.Left - $monitorInfo.rcMonitor.Left) -le $tolerance) -and
        ([Math]::Abs($rect.Top - $monitorInfo.rcMonitor.Top) -le $tolerance) -and
        ([Math]::Abs($rect.Right - $monitorInfo.rcMonitor.Right) -le $tolerance) -and
        ([Math]::Abs($rect.Bottom - $monitorInfo.rcMonitor.Bottom) -le $tolerance)
    }
  }
  [pscustomobject]@{ Handle = $handle.ToInt64(); Pid = [int]$pidValue; ProcessName = $name; Fullscreen = $fullscreen }
}

function Get-BackgroundDevGpuPercent {
  try {
    $nvidia = Get-Command 'nvidia-smi.exe' -ErrorAction Stop
    $raw = & $nvidia.Source '--query-gpu=utilization.gpu' '--format=csv,noheader,nounits' 2>$null
    $values = @($raw | ForEach-Object { $parsed = 0.0; if ([double]::TryParse(([string]$_).Trim(), [ref]$parsed)) { $parsed } })
    if (-not $values) { return $null }
    return [Math]::Round([Math]::Min(100, [Math]::Max(0, [double](($values | Measure-Object -Maximum).Maximum))), 1)
  } catch { return $null }
}

function Get-BackgroundDevSystemMetrics([bool]$IncludeGpu = $false) {
  Initialize-BackgroundDevNativeApi
  $toUInt64 = { param($time) (([uint64]$time.High -shl 32) -bor [uint64]$time.Low) }
  $cpu = 0.0
  try {
    $idle1 = New-Object SectorNine.BackgroundDev.NativeMethods+FILETIME; $kernel1 = New-Object SectorNine.BackgroundDev.NativeMethods+FILETIME; $user1 = New-Object SectorNine.BackgroundDev.NativeMethods+FILETIME
    $idle2 = New-Object SectorNine.BackgroundDev.NativeMethods+FILETIME; $kernel2 = New-Object SectorNine.BackgroundDev.NativeMethods+FILETIME; $user2 = New-Object SectorNine.BackgroundDev.NativeMethods+FILETIME
    if ([SectorNine.BackgroundDev.NativeMethods]::GetSystemTimes([ref]$idle1,[ref]$kernel1,[ref]$user1)) {
      Start-Sleep -Milliseconds 125
      if ([SectorNine.BackgroundDev.NativeMethods]::GetSystemTimes([ref]$idle2,[ref]$kernel2,[ref]$user2)) {
        $idleDelta = (& $toUInt64 $idle2) - (& $toUInt64 $idle1)
        $totalDelta = ((& $toUInt64 $kernel2) - (& $toUInt64 $kernel1)) + ((& $toUInt64 $user2) - (& $toUInt64 $user1))
        if ($totalDelta -gt 0) { $cpu = 100.0 * ($totalDelta - $idleDelta) / $totalDelta }
      }
    }
  } catch {}
  $memory = New-Object SectorNine.BackgroundDev.NativeMethods+MEMORYSTATUSEX
  $availableMb = 0.0; $totalMb = 0.0
  if ([SectorNine.BackgroundDev.NativeMethods]::GlobalMemoryStatusEx($memory)) { $availableMb = [double]$memory.AvailablePhysical / 1MB; $totalMb = [double]$memory.TotalPhysical / 1MB }
  [pscustomobject]@{
    CpuPercent = [Math]::Round($cpu, 1)
    AvailableMemoryMb = [Math]::Round($availableMb, 0)
    UsedMemoryMb = [Math]::Round([Math]::Max(0, $totalMb - $availableMb), 0)
    GpuPercent = $(if ($IncludeGpu) { Get-BackgroundDevGpuPercent } else { $null })
  }
}

function Get-BackgroundDevGameProcesses($Config) {
  $known = @{}
  foreach ($name in $Config.gameProcesses) { $known[[string]$name.ToString().ToLowerInvariant()] = $true }
  @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $known.ContainsKey($_.ProcessName.ToLowerInvariant()) } | ForEach-Object {
    [pscustomobject]@{ Pid = $_.Id; Name = $_.ProcessName }
  })
}

function Resolve-BackgroundDevMode($InputState, $Config, $Runtime) {
  $override = [string]$InputState.Override
  if ($override -eq 'PAUSE') { return [pscustomobject]@{ Mode = 'PAUSED'; Reason = 'Development paused by manual override.' } }
  if ($override -eq 'FORCE_GAMING') { $Runtime.GamingUntil = [DateTime]::UtcNow.AddSeconds([int]$Config.gamingCooldownSeconds); return [pscustomobject]@{ Mode = 'GAMING'; Reason = 'Forced gaming mode.' } }
  if ($override -eq 'FORCE_IDLE') { return [pscustomobject]@{ Mode = 'IDLE'; Reason = 'Forced idle mode.' } }
  if ([int]$InputState.GameCount -gt 0) {
    $Runtime.GamingUntil = [DateTime]::UtcNow.AddSeconds([int]$Config.gamingCooldownSeconds)
    $Runtime.IdleSamples = 0
    return [pscustomobject]@{ Mode = 'GAMING'; Reason = "Game process detected: $($InputState.GameNames -join ', ')." }
  }
  $pressure = ([double]$InputState.CpuPercent -ge [double]$Config.pressureCpuPercent) -or ([double]$InputState.AvailableMemoryMb -le [double]$Config.pressureMemoryMb)
  if ($pressure -and -not [string]::IsNullOrWhiteSpace([string]$InputState.ForegroundProcess)) {
    $Runtime.GamingUntil = [DateTime]::UtcNow.AddSeconds([int]$Config.gamingCooldownSeconds)
    $Runtime.IdleSamples = 0
    return [pscustomobject]@{ Mode = 'GAMING'; Reason = "Protective mode: foreground $($InputState.ForegroundProcess), CPU $($InputState.CpuPercent)%, available RAM $($InputState.AvailableMemoryMb) MB." }
  }
  if ($Runtime.GamingUntil -gt [DateTime]::UtcNow) {
    $Runtime.IdleSamples = 0
    return [pscustomobject]@{ Mode = 'GAMING'; Reason = 'Gaming cooldown; resources are being rechecked.' }
  }
  $gpuOkay = ($null -eq $InputState.GpuPercent) -or ([double]$InputState.GpuPercent -le [double]$Config.idleMaxGpuPercent)
  $idleEligible = ([double]$InputState.IdleSeconds -ge [double]$Config.idleAfterSeconds) -and
    ([double]$InputState.CpuPercent -le [double]$Config.idleMaxCpuPercent) -and
    ([double]$InputState.AvailableMemoryMb -ge [double]$Config.minimumIdleMemoryMb) -and $gpuOkay
  if ($idleEligible) { $Runtime.IdleSamples++ } else { $Runtime.IdleSamples = 0 }
  if ($Runtime.IdleSamples -ge [int]$Config.idleStableSamples) { return [pscustomobject]@{ Mode = 'IDLE'; Reason = "User idle for $([Math]::Round([double]$InputState.IdleSeconds)) seconds and resource headroom is available." } }
  [pscustomobject]@{ Mode = 'ACTIVE'; Reason = "Active desktop use or insufficient idle resource headroom." }
}

function Get-BackgroundDevWorkers {
  $workerDocument = Read-BackgroundDevCollection $script:BackgroundDevWorkers
  $workers = @($workerDocument.items)
  @($workers | Where-Object {
    try {
      $process = Get-Process -Id ([int]$_.pid) -ErrorAction Stop
      if ($null -eq $_.PSObject.Properties['processStartTimeUtc']) { return $false }
      $expected = [DateTime]::Parse([string]$_.processStartTimeUtc).ToUniversalTime()
      $actual = $process.StartTime.ToUniversalTime()
      [Math]::Abs(($actual - $expected).TotalSeconds) -lt 1
    } catch { $false }
  })
}

function Set-BackgroundDevWorkerPriorities([string]$Mode) {
  Invoke-BackgroundDevLocked 'workers' {
    $workers = @(Get-BackgroundDevWorkers)
    foreach ($worker in $workers) {
      try {
        $process = Get-Process -Id ([int]$worker.pid) -ErrorAction Stop
        if ($Mode -eq 'GAMING' -or $Mode -eq 'PAUSED') { $process.PriorityClass = 'Idle' }
        elseif ($Mode -eq 'ACTIVE') { $process.PriorityClass = 'BelowNormal' }
        else { $process.PriorityClass = 'BelowNormal' }
      } catch {}
    }
    Write-BackgroundDevCollection $script:BackgroundDevWorkers $workers
  }
}
