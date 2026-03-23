const CACHE_PREFIX = "encore_atlas_"
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

type CacheEntry<T> = {
  data: T
  expiresAt: number
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null

    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }

    return entry.data
  } catch {
    return null
  }
}

export function setCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlMs,
    }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // localStorage might be full — silently fail
  }
}

export function clearCache(prefix?: string): void {
  const fullPrefix = CACHE_PREFIX + (prefix ?? "")
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(fullPrefix)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach((k) => localStorage.removeItem(k))
}
