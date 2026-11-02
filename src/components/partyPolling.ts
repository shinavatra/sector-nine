export type PartyPollingIssue = 'authentication' | 'temporary'

type TimerHandle = ReturnType<typeof setTimeout>

interface PartyPollingOptions<T> {
  poll: (signal: AbortSignal) => Promise<T>
  intervalMs: number
  onSuccess: (value: T) => void
  onFailure: (error: unknown, consecutiveFailures: number, issue: PartyPollingIssue) => void
  onRecovery?: () => void
  setTimer?: (callback: () => void, delay: number) => TimerHandle
  clearTimer?: (handle: TimerHandle) => void
}

export const classifyPartyPollingError = (error: unknown): PartyPollingIssue => {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : 0
  return status === 401 || status === 403 ? 'authentication' : 'temporary'
}

export const createPartyPoller = <T>({
  poll,
  intervalMs,
  onSuccess,
  onFailure,
  onRecovery,
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = handle => clearTimeout(handle),
}: PartyPollingOptions<T>) => {
  let active = false
  let timer: TimerHandle | null = null
  let controller: AbortController | null = null
  let inFlight: Promise<void> | null = null
  let consecutiveFailures = 0

  const clearPendingTimer = () => {
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  const schedule = () => {
    if (!active) return
    clearPendingTimer()
    timer = setTimer(() => {
      timer = null
      void execute()
    }, intervalMs)
  }

  const execute = (): Promise<void> => {
    if (inFlight) return inFlight
    controller = new AbortController()
    const requestController = controller
    inFlight = poll(requestController.signal)
      .then(value => {
        if (!active || requestController.signal.aborted) return
        const recovered = consecutiveFailures > 0
        consecutiveFailures = 0
        onSuccess(value)
        if (recovered) onRecovery?.()
      })
      .catch(error => {
        if (!active || requestController.signal.aborted) return
        consecutiveFailures += 1
        onFailure(error, consecutiveFailures, classifyPartyPollingError(error))
      })
      .finally(() => {
        if (controller === requestController) controller = null
        inFlight = null
        schedule()
      })
    return inFlight
  }

  return {
    start() {
      if (active) return
      active = true
      void execute()
    },
    pollNow() {
      if (!active) return Promise.resolve()
      clearPendingTimer()
      return execute()
    },
    waitForIdle() {
      return inFlight ?? Promise.resolve()
    },
    stop() {
      active = false
      clearPendingTimer()
      controller?.abort()
      controller = null
    },
  }
}
