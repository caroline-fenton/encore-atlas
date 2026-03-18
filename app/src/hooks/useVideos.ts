import { useState, useEffect, useRef, useCallback, type MutableRefObject } from "react"
import type { Video } from "../types/video"
import {
  searchAndEnrich,
  searchWithDurationFallback,
  YouTubeQuotaError,
  type EnrichResult,
} from "../services/youtube"
import {
  buildConcertSearchQuery,
  buildInterviewSearchQuery,
} from "../services/searchQueries"

type UseVideosResult = {
  videos: Video[]
  featured: Video | null
  more: Video[]
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  retry: () => void
}

function useVideoFetch(
  fetchFn: (signal: AbortSignal) => Promise<EnrichResult>,
  loadMoreFn: (pageToken: string) => Promise<EnrichResult>,
  deps: unknown[],
): UseVideosResult {
  const [videos, setVideos] = useState<Video[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()
  const abortRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    ++generationRef.current
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setIsLoadingMore(false)
      setError(null)
      setVideos([])
      setNextPageToken(undefined)

      try {
        const result = await fetchFn(controller.signal)
        if (!cancelled) {
          setVideos(result.videos)
          setNextPageToken(result.nextPageToken)
        }
      } catch (err) {
        if (!cancelled) {
          // Silently degrade on quota errors — just show empty results
          if (!(err instanceof YouTubeQuotaError)) {
            setError(
              err instanceof Error ? err.message : "Failed to load videos",
            )
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, retryCount])

  const loadMore = useCallback(async () => {
    if (!nextPageToken || isLoadingMore) return

    const generation = generationRef.current
    setIsLoadingMore(true)
    try {
      const result = await loadMoreFn(nextPageToken)
      // Only apply results if the artist hasn't changed since we started
      if (generation === generationRef.current) {
        setVideos((prev) => [...prev, ...result.videos])
        setNextPageToken(result.nextPageToken)
      }
    } catch (err) {
      if (generation === generationRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to load more videos",
        )
      }
    } finally {
      if (generation === generationRef.current) {
        setIsLoadingMore(false)
      }
    }
  }, [nextPageToken, isLoadingMore, loadMoreFn])

  const featured = videos.length > 0 ? videos[0] : null
  const more = videos.length > 1 ? videos.slice(1) : []

  return {
    videos,
    featured,
    more,
    isLoading,
    isLoadingMore,
    error,
    hasMore: !!nextPageToken,
    loadMore,
    retry: () => setRetryCount((c) => c + 1),
  }
}

export function useArtistConcerts(artistName: string): UseVideosResult {
  const effectiveDurationRef: MutableRefObject<"long" | "any"> = useRef("long")

  const fetchFn = useCallback(async (signal: AbortSignal) => {
    const query = buildConcertSearchQuery(artistName)
    const result = await searchWithDurationFallback(query, {
      maxResults: 5,
      videoDuration: "long",
      artistName,
      signal,
    })
    // Track whether fallback switched from "long" to "any"
    effectiveDurationRef.current = result.effectiveDuration === "any" ? "any" : "long"
    return result
  }, [artistName])

  const loadMoreFn = useCallback(
    async (pageToken: string) => {
      const query = buildConcertSearchQuery(artistName)
      return searchAndEnrich(query, {
        maxResults: 5,
        videoDuration: effectiveDurationRef.current,
        artistName,
        pageToken,
      })
    },
    [artistName],
  )

  return useVideoFetch(fetchFn, loadMoreFn, [artistName])
}

export function useArtistInterviews(artistName: string): UseVideosResult {
  const fetchFn = useCallback(async (signal: AbortSignal) => {
    const query = buildInterviewSearchQuery(artistName)
    return searchAndEnrich(query, { maxResults: 4, artistName, signal })
  }, [artistName])

  const loadMoreFn = useCallback(
    async (pageToken: string) => {
      const query = buildInterviewSearchQuery(artistName)
      return searchAndEnrich(query, { maxResults: 4, artistName, pageToken })
    },
    [artistName],
  )

  return useVideoFetch(fetchFn, loadMoreFn, [artistName])
}
