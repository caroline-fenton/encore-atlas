import { useOutletContext } from "react-router-dom"
import { useRef, useState, useCallback } from "react"
import type { AppOutletContext } from "../layouts/AppLayout"
import type { Video } from "../types/video"
import { useArtistConcerts, useArtistInterviews, useArtistMusicVideos } from "../hooks/useVideos"
import { useArtistPage } from "../hooks/useArtistPage"
import { useDecadeFilter } from "../hooks/useDecadeFilter"
import { useWatchHistory } from "../hooks/useWatchHistory"
import VideoHeroSkeleton from "../components/shared/VideoHeroSkeleton"
import VideoCardSkeleton from "../components/shared/VideoCardSkeleton"
import ErrorState from "../components/shared/ErrorState"
import EmptyState from "../components/shared/EmptyState"
import BuildingState from "../components/shared/BuildingState"
import ArtistBio from "../components/shared/ArtistBio"
import EpicArtistPage from "../components/liveShows/EpicArtistPage"
import StandardArtistPage from "../components/liveShows/StandardArtistPage"

/**
 * Maps cached artist_videos rows to the Video type used by display components.
 */
function mapCachedVideos(
  videos: {
    youtube_video_id: string
    title: string
    description: string | null
    thumbnail_url: string | null
    published_at: string | null
    view_count: number | null
    duration: string | null
    channel_title: string | null
  }[],
): Video[] {
  return videos.map((v) => ({
    id: v.youtube_video_id,
    title: v.title,
    channelTitle: v.channel_title ?? "",
    description: v.description ?? "",
    thumbnailUrl:
      v.thumbnail_url ??
      `https://img.youtube.com/vi/${v.youtube_video_id}/hqdefault.jpg`,
    youtubeUrl: `https://www.youtube.com/watch?v=${v.youtube_video_id}`,
    duration: v.duration ?? "",
    publishedAt: v.published_at ?? "",
    viewCount: v.view_count ?? undefined,
  }))
}

export default function LiveShowsPage() {
  const { selectedArtistId, selectedArtistName, setSelectedArtist, user, waitForAuth } =
    useOutletContext<AppOutletContext>()

  // Try the lazy curation pipeline first
  const artistPage = useArtistPage(selectedArtistName)

  // Only fall back to direct YouTube search after the pipeline has definitively
  // failed or returned no videos. While the pipeline is still loading, pass ""
  // to prevent the fallback from firing and burning YouTube quota.
  const pipelineSettled = !artistPage.isLoading && !artistPage.isBuilding
  const pipelineSucceeded =
    pipelineSettled && artistPage.data !== null && artistPage.data.videos.length > 0
  const pipelineFailed =
    pipelineSettled && !pipelineSucceeded

  const youtubeResult = useArtistConcerts(
    pipelineFailed ? selectedArtistName : "",
  )

  // Determine which data source to use
  const useCached = pipelineSucceeded
  const allVideos = useCached
    ? mapCachedVideos(artistPage.data!.videos)
    : youtubeResult.videos
  const isLoading = !pipelineSettled || (pipelineFailed && youtubeResult.isLoading)
  const error = pipelineFailed ? youtubeResult.error : artistPage.error
  const hasMore = useCached ? false : youtubeResult.hasMore
  const loadMore = youtubeResult.loadMore
  const isLoadingMore = youtubeResult.isLoadingMore
  // Always retry the pipeline first — if it failed transiently, retrying
  // only the YouTube fallback would never re-attempt server-side caching.
  const retry = artistPage.retry

  const artistId = artistPage.data?.artist.id ?? null
  const { watchedVideoIds, recordWatch } = useWatchHistory(
    artistId,
    user,
    waitForAuth,
  )

  // Use persisted data from the artist page cache when available; only fall
  // back to live YouTube search if the pipeline didn't return these types.
  const cachedInterviews = artistPage.data?.interview_videos
  const cachedMusicVideos = artistPage.data?.music_videos
  const interviewsSynced = artistPage.data?.interviews_synced ?? false
  const musicVideosSynced = artistPage.data?.music_videos_synced ?? false
  const { videos: liveInterviewVideos } = useArtistInterviews(
    pipelineSettled && !interviewsSynced ? selectedArtistName : "",
  )
  const { videos: liveMusicVideos } = useArtistMusicVideos(
    pipelineSettled && !musicVideosSynced ? selectedArtistName : "",
  )
  const interviewVideos = interviewsSynced
    ? mapCachedVideos(cachedInterviews ?? [])
    : liveInterviewVideos
  const musicVideos = musicVideosSynced
    ? mapCachedVideos(cachedMusicVideos ?? [])
    : liveMusicVideos
  const { filtered, selectedDecade, setSelectedDecade } = useDecadeFilter(
    allVideos,
    selectedArtistName,
  )

  // Hero always uses the first video from the full list (unfiltered).
  // Decade filter only affects "More Live Sets".
  const featured = allVideos.length > 0 ? allVideos[0] : null
  const more = selectedDecade
    ? filtered.filter((v) => v.id !== featured?.id)
    : allVideos.length > 1 ? allVideos.slice(1) : []

  const [nowPlaying, setNowPlaying] = useState<Video | null>(null)
  const [nowPlayingArtist, setNowPlayingArtist] = useState(selectedArtistName)
  const heroRef = useRef<HTMLDivElement>(null)

  if (nowPlayingArtist !== selectedArtistName) {
    setNowPlayingArtist(selectedArtistName)
    setNowPlaying(null)
  }

  const activeVideo = nowPlaying ?? featured
  const artistContext = artistPage.data?.artist.artist_context
  const contextRelatedArtists = artistContext?.relatedArtists ?? []
  const relatedArtists = contextRelatedArtists.length > 0
    ? contextRelatedArtists
    : (artistPage.data?.artist.related_artists ?? []).map((name) => ({
        name,
        reason: "",
      }))

  const handleSelectVideo = useCallback((video: Video) => {
    setNowPlaying(video)
    heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    // Fire-and-forget: record the watch
    recordWatch(video, selectedArtistName).catch(() => {})
  }, [recordWatch, selectedArtistName])

  // Show building state when the edge function is generating a new artist page
  if (artistPage.isBuilding) {
    return (
      <div className="space-y-8 pb-10">
        <header>
          <h1 className="font-display text-5xl md:text-6xl font-normal tracking-[0.22em] leading-none text-black/80 uppercase">
            {selectedArtistName}
          </h1>
        </header>
        <BuildingState artistName={selectedArtistName} />
      </div>
    )
  }

  const isEpicArtist = Boolean(artistContext?.epicTemplate?.enabled)
  const layoutProps = activeVideo ? {
    artistId: selectedArtistId,
    artistName: selectedArtistName,
    tags: useCached ? artistPage.data?.artist.tags ?? null : null,
    bioImageUrl: artistPage.data?.artist.bio_image_url ?? null,
    city: artistContext?.city ?? null,
    yearsActive: artistContext?.yearsActive ?? null,
    context: artistContext ?? null,
    activeVideo,
    moreVideos: more,
    interviewVideos,
    musicVideos,
    allVideos,
    watchedVideoIds,
    relatedArtists,
    selectedDecade,
    hasMore,
    isLoadingMore,
    heroRef,
    onSelectArtist: setSelectedArtist,
    onSelectVideo: handleSelectVideo,
    onSelectDecade: setSelectedDecade,
    onLoadMore: loadMore,
  } : null

  return (
    <div className="space-y-8 pb-10">
      {!layoutProps && (
        <header>
          <h1 className="font-display text-5xl md:text-6xl font-normal tracking-[0.22em] leading-none text-black/80 uppercase">
            {selectedArtistName}
          </h1>
        </header>
      )}

      {error && <ErrorState message={error} onRetry={retry} />}

      {!error && isLoading && (
        <>
          <section className="space-y-4">
            <VideoHeroSkeleton />
            <div className="py-4 space-y-3">
              <div className="h-6 w-48 animate-pulse rounded bg-black/10" />
              <div className="h-4 w-32 animate-pulse rounded bg-black/8" />
            </div>
          </section>
          <section className="space-y-4">
            <div className="h-6 w-36 animate-pulse rounded bg-black/10" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          </section>
        </>
      )}

      {!error && !isLoading && !featured && !hasMore && (
        <>
          <ArtistBio context={artistContext ?? null} isLoading={false} />
          <EmptyState
            message={`No concert videos found for ${selectedArtistName}.`}
          />
        </>
      )}

      {!error && !isLoading && !featured && hasMore && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 border border-stone-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/60 hover:border-[#d94f43]/30 hover:text-[#d94f43] disabled:opacity-50"
          >
            {isLoadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {!error && !isLoading && layoutProps && (
        isEpicArtist
          ? <EpicArtistPage {...layoutProps} />
          : <StandardArtistPage {...layoutProps} />
      )}
    </div>
  )
}
