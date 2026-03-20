// YouTube Data API v3 response types

export type YouTubeThumbnail = {
  url: string
  width: number
  height: number
}

export type YouTubeThumbnails = {
  default: YouTubeThumbnail
  medium?: YouTubeThumbnail
  high?: YouTubeThumbnail
  standard?: YouTubeThumbnail
  maxres?: YouTubeThumbnail
}

export type YouTubeSearchItem = {
  id: { kind: string; videoId: string }
  snippet: {
    title: string
    description: string
    channelTitle: string
    publishedAt: string
    thumbnails: YouTubeThumbnails
  }
}

export type YouTubeSearchResponse = {
  pageInfo: { totalResults: number; resultsPerPage: number }
  items: YouTubeSearchItem[]
  nextPageToken?: string
}

export type YouTubeVideoItem = {
  id: string
  snippet: {
    title: string
    description: string
    channelTitle: string
    publishedAt: string
    thumbnails: YouTubeThumbnails
  }
  contentDetails: {
    duration: string // ISO 8601 e.g. "PT1H42M15S"
  }
  statistics: {
    viewCount: string
    likeCount?: string
  }
}

export type YouTubeVideoListResponse = {
  pageInfo: { totalResults: number; resultsPerPage: number }
  items: YouTubeVideoItem[]
}
