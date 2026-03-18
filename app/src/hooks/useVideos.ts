import { useState, useEffect, useRef } from "react"
import type { Video } from "../types/video"
import { searchAndEnrich } from "../services/youtube"
import {
  buildConcertSearchQuery,
  buildInterviewSearchQuery,
} from "../services/searchQueries"

type UseVideosResult = {
  videos: Video[]
  featured: Video | null
  more: Video[]
  isLoading: boolean
  error: string | null
  retry: () => void
}

function useVideoFetch(
  fetchFn: () => Promise<Video[]>,
  deps: unknown[],
): UseVideosResult {
  const [videos, setVideos] = useState<Video[]>([])
  const [isLoading, setIsLoading] = useState(true)
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
      setError(null)

      try {
        const result = await fetchFn()
        if (!cancelled) {
          setVideos(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load videos",
          )
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

  const featured = videos.length > 0 ? videos[0] : null
  const more = videos.length > 1 ? videos.slice(1) : []

  return {
    videos,
    featured,
    more,
    isLoading,
    error,
    retry: () => setRetryCount((c) => c + 1),
  }
}

export function useArtistConcerts(artistName: string): UseVideosResult {
  return useVideoFetch(async () => {
    const query = buildConcertSearchQuery(artistName)
    return searchAndEnrich(query, { maxResults: 5, videoDuration: "long" })
  }, [artistName])
}

export function useArtistInterviews(artistName: string): UseVideosResult {
  return useVideoFetch(async () => {
    const query = buildInterviewSearchQuery(artistName)
    return searchAndEnrich(query, { maxResults: 4 })
  }, [artistName])
}
