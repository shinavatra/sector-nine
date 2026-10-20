export type RefreshResult = { token: string | null; completedAt: number }

export type RefreshLock = {
  runExclusive<T>(work: () => Promise<T>): Promise<T>
}

type CoordinatorOptions = {
  lock: RefreshLock
  performRefresh: () => Promise<string | null>
  publish: (result: RefreshResult) => void
  subscribe: (listener: (result: RefreshResult) => void) => () => void
  acceptResult: (token: string | null) => void
}

export class CrossTabRefreshCoordinator {
  private revision = 0
  private latest: RefreshResult | null = null
  private inFlight: Promise<string | null> | null = null
  private readonly unsubscribe: () => void

  constructor(private readonly options: CoordinatorOptions) {
    this.unsubscribe = options.subscribe(result => this.accept(result))
  }

  private accept(result: RefreshResult) {
    if (this.latest && result.completedAt < this.latest.completedAt) return
    this.latest = result
    this.revision += 1
    this.options.acceptResult(result.token)
  }

  refresh(): Promise<string | null> {
    if (this.inFlight) return this.inFlight
    const startingRevision = this.revision
    this.inFlight = this.options.lock.runExclusive(async () => {
      // Another tab may have completed while this tab waited for the lock.
      if (this.revision !== startingRevision && this.latest) return this.latest.token
      const result = { token: await this.options.performRefresh(), completedAt: Date.now() }
      this.accept(result)
      this.options.publish(result)
      return result.token
    }).finally(() => { this.inFlight = null })
    return this.inFlight
  }

  close() { this.unsubscribe() }
}

const indexedDbLock = (name: string): RefreshLock | null => {
  if (typeof indexedDB === 'undefined') return null
  const owner = crypto.randomUUID()
  const database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('sector-nine-session-coordination', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('locks')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const tryAcquire = async () => {
    const db = await database
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction('locks', 'readwrite')
      const store = tx.objectStore('locks')
      let acquired = false
      const request = store.get(name)
      request.onsuccess = () => {
        const current = request.result as { owner?: string; expiresAt?: number } | undefined
        if (!current || Number(current.expiresAt) <= Date.now()) {
          store.put({ owner, expiresAt: Date.now() + 30_000 }, name)
          acquired = true
        }
      }
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => resolve(acquired)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }
  const release = async () => {
    const db = await database
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('locks', 'readwrite')
      const store = tx.objectStore('locks')
      const request = store.get(name)
      request.onsuccess = () => {
        if ((request.result as { owner?: string } | undefined)?.owner === owner) store.delete(name)
      }
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }
  const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds))
  return {
    async runExclusive<T>(work: () => Promise<T>) {
      const deadline = Date.now() + 35_000
      while (Date.now() < deadline) {
        if (await tryAcquire().catch(() => false)) {
          try { return await work() } finally { await release().catch(() => undefined) }
        }
        await wait(50)
      }
      throw new Error('Cross-tab refresh lock timed out')
    },
  }
}
export const browserRefreshLock = (name: string): RefreshLock => {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return { runExclusive: work => navigator.locks.request(name, { mode: 'exclusive' }, work) }
  }
  const fallback = indexedDbLock(name)
  if (fallback) return fallback
  // Fail closed: refreshing without a cross-tab primitive can trigger secure reuse detection.
  return { runExclusive: async () => { throw new Error('Cross-tab refresh coordination is unavailable') } }
}
