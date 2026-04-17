import { useState, useEffect, useCallback, useRef } from "react"
import { fetchArtistPage, type ArtistPageData } from "../services/artistPage"

type UseArtistPageResult = {
  data: ArtistPageData | null
  isLoading: boolean
  isBuilding: boolean
  error: string | null
  retry: () => void
}

/**
 * Fetches the artist page data from Supabase (cache hit) or triggers
 * the edge function to build it (cache miss). Exposes `isBuilding`
 * so the UI can show a special loading state for first-time pages.
 */
export function useArtistPage(artistName: string): UseArtistPageResult {
  const [data, setData] = useState<ArtistPageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBuilding, setIsBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    let cancelled = false

    async function load() {
      setIsLoading(true)
      setIsBuilding(false)
      setError(null)
      setData(null)

      try {
        // fetchArtistPage tries cache first, then calls edge function
        // We use a two-phase approach: check cache locally first for instant UX,
        // then if miss, show "building" state while edge function runs
        const result = await fetchArtistPage(artistName)

        if (!cancelled) {
          // If it wasn't a cache hit, the edge function built it (building phase happened)
          if (!result.was_cache_hit) {
            setIsBuilding(true)
            // Brief pause so the "building" message flashes before content appears
            await new Promise((r) => setTimeout(r, 300))
            // Re-check after delay — user may have switched artists
            if (cancelled) return
          }
          setData(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load artist page",
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          setIsBuilding(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [artistName, retryCount])

  const retry = useCallback(() => setRetryCount((c) => c + 1), [])

  return { data, isLoading, isBuilding, error, retry }
}
