export type LiveShow = {
  id: string
  artistId: string
  title: string
  venue: string
  city?: string
  year: number
  duration: string // e.g. "1:42:15"
  thumbnailUrl: string
  youtubeUrl: string
  isFeatured?: boolean
  isCompleteConcert?: boolean
}
