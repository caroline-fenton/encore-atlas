export type Video = {
  id: string
  title: string
  channelTitle: string
  description: string
  thumbnailUrl: string
  youtubeUrl: string
  duration: string // formatted e.g. "1:42:15"
  publishedAt: string
  viewCount?: number
  // Enrichment fields for curated content
  venue?: string
  city?: string
  year?: number
  isFeatured?: boolean
  isCompleteConcert?: boolean
}

export type VideoCategory = "concert" | "musicVideo" | "interview"
