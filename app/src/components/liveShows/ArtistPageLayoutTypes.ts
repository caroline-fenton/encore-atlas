import type { RefObject } from "react"
import type { ArtistContext } from "../../services/artistPage"
import type { Video } from "../../types/video"

export type RelatedArtist = NonNullable<ArtistContext["relatedArtists"]>[number]

export type ArtistPageLayoutProps = {
  artistId: string
  artistName: string
  tags: string[] | null
  bioImageUrl: string | null
  city: string | null
  yearsActive: string | null
  context: ArtistContext | null
  activeVideo: Video
  moreVideos: Video[]
  interviewVideos: Video[]
  musicVideos: Video[]
  allVideos: Video[]
  watchedVideoIds: Set<string>
  relatedArtists: RelatedArtist[]
  selectedDecade: string | null
  hasMore: boolean
  isLoadingMore: boolean
  heroRef: RefObject<HTMLDivElement | null>
  onSelectArtist: (artist: { id: string; name: string }) => void
  onSelectVideo: (video: Video) => void
  onSelectDecade: (decade: string | null) => void
  onLoadMore: () => void
}
