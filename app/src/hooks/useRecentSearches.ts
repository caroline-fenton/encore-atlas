import { useState, useCallback } from "react"

const STORAGE_KEY = "encore_atlas_recent_searches"
const MAX_ITEMS = 10

function readSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

function writeSearches(searches: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches))
  } catch {
    // localStorage might be full
  }
}

export function useRecentSearches(maxItems = MAX_ITEMS) {
  const [searches, setSearches] = useState<string[]>(readSearches)

  const addSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim()
      if (!trimmed) return

      setSearches((prev) => {
        // Remove duplicate (case-insensitive), add to front
        const filtered = prev.filter(
          (s) => s.toLowerCase() !== trimmed.toLowerCase(),
        )
        const updated = [trimmed, ...filtered].slice(0, maxItems)
        writeSearches(updated)
        return updated
      })
    },
    [maxItems],
  )

  const removeSearch = useCallback((query: string) => {
    setSearches((prev) => {
      const updated = prev.filter(
        (s) => s.toLowerCase() !== query.toLowerCase(),
      )
      writeSearches(updated)
      return updated
    })
  }, [])

  const clearAll = useCallback(() => {
    setSearches([])
    writeSearches([])
  }, [])

  return { searches, addSearch, removeSearch, clearAll }
}
