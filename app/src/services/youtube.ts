import type {
  YouTubeSearchResponse,
  YouTubeSearchItem,
  YouTubeVideoListResponse,
  YouTubeVideoItem,
} from "../types/youtube"
import type { Video } from "../types/video"
import { getCached, setCache } from "./cache"

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string
const API_BASE = "https://www.googleapis.com/youtube/v3"

export class YouTubeApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "YouTubeApiError"
    this.status = status
  }
}

export class YouTubeQuotaError extends YouTubeApiError {
  constructor() {
    super("YouTube API daily quota exceeded", 403)
    this.name = "YouTubeQuotaError"
  }
}

// --- ISO 8601 duration parsing ---

export function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return "0:00"

  const hours = parseInt(match[1] || "0", 10)
  const minutes = parseInt(match[2] || "0", 10)
  const seconds = parseInt(match[3] || "0", 10)

  const pad = (n: number) => n.toString().padStart(2, "0")

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${minutes}:${pad(seconds)}`
}

// --- Best thumbnail picker ---

function bestThumbnail(
  thumbnails: YouTubeVideoItem["snippet"]["thumbnails"],
): string {
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default.url
  )
}

// --- API calls ---

type SearchOptions = {
  maxResults?: number
  videoDuration?: "long" | "medium" | "any"
  order?: "relevance" | "viewCount" | "date"
  pageToken?: string
  signal?: AbortSignal
}

type SearchResult = {
  items: YouTubeSearchItem[]
  nextPageToken?: string
}

async function apiFetch<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, signal ? { signal } : undefined)

  if (!res.ok) {
    if (res.status === 403) {
      // Check if this is actually a quota error vs. an auth/permission error
      try {
        const body = await res.json()
        const reason = body?.error?.errors?.[0]?.reason
        if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
          const now = new Date()
          const midnight = new Date(now)
          midnight.setHours(24, 0, 0, 0)
          const ttl = midnight.getTime() - now.getTime()
          setCache("quota_exhausted", true, ttl)
          throw new YouTubeQuotaError()
        }
      } catch (e) {
        if (e instanceof YouTubeQuotaError) throw e
        // If we can't parse the body, fall through to generic error
      }
    }
    throw new YouTubeApiError(
      `YouTube API error: ${res.status} ${res.statusText}`,
      res.status,
    )
  }

  return res.json() as Promise<T>
}

export function isQuotaExhausted(): boolean {
  return getCached<boolean>("quota_exhausted") === true
}

export async function searchVideos(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const { maxResults = 5, videoDuration = "any", order = "relevance", pageToken, signal } = options

  const cacheKey = `search_${query}_${maxResults}_${videoDuration}_${order}_${pageToken ?? ""}`
  const cached = getCached<SearchResult>(cacheKey)
  if (cached) return cached

  if (isQuotaExhausted()) {
    throw new YouTubeQuotaError()
  }

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    maxResults: String(maxResults),
    videoDuration,
    order,
    key: API_KEY,
  })
  if (pageToken) params.set("pageToken", pageToken)

  const data = await apiFetch<YouTubeSearchResponse>(
    `${API_BASE}/search?${params}`,
    signal,
  )

  const result: SearchResult = {
    items: data.items,
    nextPageToken: data.nextPageToken,
  }
  setCache(cacheKey, result)
  return result
}

export async function getVideoDetails(
  videoIds: string[],
  signal?: AbortSignal,
): Promise<YouTubeVideoItem[]> {
  if (videoIds.length === 0) return []

  // Check cache for each video, only fetch missing ones
  const results: YouTubeVideoItem[] = []
  const uncachedIds: string[] = []

  for (const id of videoIds) {
    const cached = getCached<YouTubeVideoItem>(`video_${id}`)
    if (cached) {
      results.push(cached)
    } else {
      uncachedIds.push(id)
    }
  }

  if (uncachedIds.length > 0) {
    if (isQuotaExhausted()) {
      throw new YouTubeQuotaError()
    }

    const params = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      id: uncachedIds.join(","),
      key: API_KEY,
    })

    const data = await apiFetch<YouTubeVideoListResponse>(
      `${API_BASE}/videos?${params}`,
      signal,
    )

    for (const item of data.items) {
      setCache(`video_${item.id}`, item)
      results.push(item)
    }
  }

  // Return in the original order
  return videoIds
    .map((id) => results.find((r) => r.id === id))
    .filter((item): item is YouTubeVideoItem => item != null)
}

// --- Mappers ---

export function mapVideoItemToVideo(item: YouTubeVideoItem): Video {
  return {
    id: item.id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    description: item.snippet.description,
    thumbnailUrl: bestThumbnail(item.snippet.thumbnails),
    youtubeUrl: `https://www.youtube.com/watch?v=${item.id}`,
    duration: parseDuration(item.contentDetails.duration),
    publishedAt: item.snippet.publishedAt,
    viewCount: item.statistics.viewCount
      ? parseInt(item.statistics.viewCount, 10)
      : undefined,
  }
}

function mapSearchItemToVideoId(item: YouTubeSearchItem): string {
  return item.id.videoId
}

// --- Relevance filtering ---

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "")
}

function isRelevantVideo(video: Video, artistName: string): boolean {
  const name = artistName.toLowerCase()
  const stripped = name.replace(/^the\s+/, "")
  const title = video.title.toLowerCase()

  // Normalize: strip ALL non-alphanumeric chars to handle
  // spacing ("Meat Loaf" vs "Meatloaf"), punctuation ("G.B.H." vs "GBH"),
  // slashes ("AC/DC" vs "ACDC"), ampersands ("Simon & Garfunkel" vs "and"), etc.
  const titleNorm = normalize(title)
  const strippedNorm = normalize(stripped)
  const nameNorm = normalize(name)

  return (
    title.includes(stripped) ||
    title.includes(name) ||
    titleNorm.includes(strippedNorm) ||
    titleNorm.includes(nameNorm)
  )
}

// --- High-level: search + enrich ---

export type EnrichResult = {
  videos: Video[]
  nextPageToken?: string
  effectiveDuration?: "long" | "medium" | "any"
}

export async function searchAndEnrich(
  query: string,
  options: SearchOptions & { artistName?: string } = {},
): Promise<EnrichResult> {
  const { artistName, ...searchOpts } = options
  const { items: searchResults, nextPageToken } = await searchVideos(query, searchOpts)
  const videoIds = searchResults.map(mapSearchItemToVideoId)
  const details = await getVideoDetails(videoIds, searchOpts.signal)
  let videos = details.map(mapVideoItemToVideo)

  // Filter out irrelevant results if we know the artist name
  if (artistName) {
    videos = videos.filter((v) => isRelevantVideo(v, artistName))
  }

  return { videos, nextPageToken }
}

// Duration fallback: if "long" returns too few, retry with "any"
export async function searchWithDurationFallback(
  query: string,
  options: SearchOptions & { artistName?: string } = {},
  minResults = 3,
): Promise<EnrichResult> {
  const result = await searchAndEnrich(query, options)

  if (
    result.videos.length < minResults &&
    options.videoDuration === "long"
  ) {
    const fallback = await searchAndEnrich(query, { ...options, videoDuration: "any" })
    return { ...fallback, effectiveDuration: "any" }
  }

  return { ...result, effectiveDuration: options.videoDuration }
}
