import { useState, useEffect, useCallback, useRef } from "react"
import {
  getCachedArtistPage,
  buildArtistPage,
  type ArtistPageData,
} from "../services/artistPage"

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
        // Phase 1: check cache (fast)
        const cached = await getCachedArtistPage(artistName)
        if (cancelled) return

        if (cached) {
          setData(cached)
          return
        }

        // Phase 2: cache miss — show building state while edge function runs
        setIsBuilding(true)
        const result = await buildArtistPage(artistName)
        if (cancelled) return
        setData(result)
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
