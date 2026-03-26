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
  buildMusicVideoSearchQuery,
  buildInterviewSearchQuery,
  type SearchFilters,
} from "../services/searchQueries"
import { parseYearFromTitle } from "../utils/parseYear"

/**
 * Sort videos by proximity to the requested year.
 * Exact matches first, then ±2 years, then everything else.
 * Within each group, original order is preserved.
 */
function sortByYearMatch(videos: Video[], yearFilter?: string): Video[] {
  if (!yearFilter?.trim()) return videos
  const targetYear = parseInt(yearFilter.trim(), 10)
  if (isNaN(targetYear)) return videos

  const exact: Video[] = []
  const nearby: Video[] = []
  const rest: Video[] = []
  for (const v of videos) {
    const parsed = parseYearFromTitle(v.title)
    if (parsed === targetYear) {
      exact.push(v)
    } else if (parsed != null && Math.abs(parsed - targetYear) <= 2) {
      nearby.push(v)
    } else {
      rest.push(v)
    }
  }
  return [...exact, ...nearby, ...rest]
}

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
  yearFilter?: string,
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
          setVideos(sortByYearMatch(result.videos, yearFilter))
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
        setVideos((prev) => sortByYearMatch([...prev, ...result.videos], yearFilter))
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

export function useArtistConcerts(artistName: string, filters?: SearchFilters): UseVideosResult {
  const effectiveDurationRef: MutableRefObject<"long" | "any"> = useRef("long")
  const filtersKey = `${filters?.year ?? ""}|${filters?.album ?? ""}`

  const fetchFn = useCallback(async (signal: AbortSignal) => {
    const query = buildConcertSearchQuery(artistName, filters)
    const result = await searchWithDurationFallback(query, {
      maxResults: 5,
      videoDuration: "long",
      artistName,
      signal,
    })
    effectiveDurationRef.current = result.effectiveDuration === "any" ? "any" : "long"
    return result
  }, [artistName, filtersKey])

  const loadMoreFn = useCallback(
    async (pageToken: string) => {
      const query = buildConcertSearchQuery(artistName, filters)
      return searchAndEnrich(query, {
        maxResults: 5,
        videoDuration: effectiveDurationRef.current,
        artistName,
        pageToken,
      })
    },
    [artistName, filtersKey],
  )

  return useVideoFetch(fetchFn, loadMoreFn, [artistName, filtersKey], filters?.year)
}

export function useArtistMusicVideos(artistName: string, filters?: SearchFilters): UseVideosResult {
  const filtersKey = `${filters?.year ?? ""}|${filters?.album ?? ""}`

  const fetchFn = useCallback(async (signal: AbortSignal) => {
    const query = buildMusicVideoSearchQuery(artistName, filters)
    return searchAndEnrich(query, { maxResults: 5, artistName, signal })
  }, [artistName, filtersKey])

  const loadMoreFn = useCallback(
    async (pageToken: string) => {
      const query = buildMusicVideoSearchQuery(artistName, filters)
      return searchAndEnrich(query, { maxResults: 5, artistName, pageToken })
    },
    [artistName, filtersKey],
  )

  return useVideoFetch(fetchFn, loadMoreFn, [artistName, filtersKey], filters?.year)
}

export function useArtistInterviews(artistName: string, filters?: SearchFilters): UseVideosResult {
  const filtersKey = `${filters?.year ?? ""}|${filters?.album ?? ""}`

  const fetchFn = useCallback(async (signal: AbortSignal) => {
    const query = buildInterviewSearchQuery(artistName, filters)
    return searchAndEnrich(query, { maxResults: 5, artistName, signal })
  }, [artistName, filtersKey])

  const loadMoreFn = useCallback(
    async (pageToken: string) => {
      const query = buildInterviewSearchQuery(artistName, filters)
      return searchAndEnrich(query, { maxResults: 5, artistName, pageToken })
    },
    [artistName, filtersKey],
  )

  return useVideoFetch(fetchFn, loadMoreFn, [artistName, filtersKey], filters?.year)
}
