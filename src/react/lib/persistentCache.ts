const CACHE_PREFIX = 'argo-warehouse:v3:'
const MAX_PERSISTED_ENTRIES = 64

type CacheEntry<T> = {
  value: T
  expiresAt: number
  touchedAt: number
}

const memoryCache = new Map<string, CacheEntry<unknown>>()
const pendingLoads = new Map<string, Promise<unknown>>()

function storageKey(key: string) {
  return `${CACHE_PREFIX}${key}`
}

function readEntry<T>(key: string): CacheEntry<T> | null {
  const memoryEntry = memoryCache.get(key) as CacheEntry<T> | undefined
  if (memoryEntry) return memoryEntry
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(storageKey(key))
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (!entry || typeof entry.expiresAt !== 'number') return null
    memoryCache.set(key, entry)
    return entry
  } catch {
    return null
  }
}

export function readCachedQuery<T>(key: string): T | null {
  return readEntry<T>(key)?.value ?? null
}

function trimStorage() {
  if (typeof window === 'undefined') return
  const entries: Array<{ key: string; touchedAt: number }> = []

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(CACHE_PREFIX)) continue
    try {
      const entry = JSON.parse(window.localStorage.getItem(key) ?? '') as Partial<CacheEntry<unknown>>
      entries.push({ key, touchedAt: entry.touchedAt ?? 0 })
    } catch {
      window.localStorage.removeItem(key)
    }
  }

  entries
    .sort((a, b) => b.touchedAt - a.touchedAt)
    .slice(MAX_PERSISTED_ENTRIES)
    .forEach((entry) => window.localStorage.removeItem(entry.key))
}

function writeEntry<T>(key: string, value: T, ttlMs: number) {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
    touchedAt: Date.now(),
  }
  memoryCache.set(key, entry)

  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(entry))
    trimStorage()
  } catch {
    // The app remains fully functional if storage is unavailable or full.
  }
}

export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  options: { bypass?: boolean } = {},
): Promise<T> {
  const cached = readEntry<T>(key)
  if (!options.bypass && cached && cached.expiresAt > Date.now()) return cached.value

  const pending = pendingLoads.get(key) as Promise<T> | undefined
  if (pending) return pending

  const load = loader()
    .then((value) => {
      writeEntry(key, value, ttlMs)
      return value
    })
    .catch((error) => {
      if (cached?.value !== undefined) return cached.value
      throw error
    })
    .finally(() => pendingLoads.delete(key))

  pendingLoads.set(key, load)
  return load
}

export function invalidateCachePrefix(prefix: string) {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key)
  }
  if (typeof window === 'undefined') return

  const keysToRemove: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(storageKey(prefix))) keysToRemove.push(key)
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key))
}
