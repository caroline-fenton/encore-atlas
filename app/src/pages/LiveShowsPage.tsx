import { useOutletContext } from "react-router-dom"
import { useRef, useState, useCallback } from "react"
import type { AppOutletContext } from "../layouts/AppLayout"
import type { Video } from "../types/video"
import type { ArtistContext } from "../services/artistPage"
import { useArtistConcerts, useArtistInterviews, useArtistMusicVideos } from "../hooks/useVideos"
import { useArtistPage } from "../hooks/useArtistPage"
import { useDecadeFilter } from "../hooks/useDecadeFilter"
import { useWatchHistory } from "../hooks/useWatchHistory"
import ArtistBio from "../components/shared/ArtistBio"
import MerchSidebar from "../components/shared/MerchSidebar"
import VideoHero from "../components/liveShows/VideoHero"
import VideoHeroSkeleton from "../components/shared/VideoHeroSkeleton"
import VideoCardSkeleton from "../components/shared/VideoCardSkeleton"
import ErrorState from "../components/shared/ErrorState"
import EmptyState from "../components/shared/EmptyState"
import BuildingState from "../components/shared/BuildingState"
import ContentCards from "../components/liveShows/ContentCards"
import ArtistLocationMap from "../components/shared/ArtistLocationMap"

const SAME_VIBE_COLORS = [
  "#d94f43", "#4db8e8", "#c2d44a", "#3580b0",
  "#f07cbf", "#5a9a6e", "#eba264", "#9256a8",
  "#6fd4a2", "#a8612e", "#62d4eb", "#b0456a",
]

function sameVibeTextSize(name: string): string {
  const longestWord = Math.max(...name.split(/\s+/).map((word) => word.length))

  if (longestWord > 12) return "text-[11px] sm:text-xs lg:text-base"
  if (longestWord > 10) return "text-xs sm:text-sm lg:text-lg"
  if (longestWord > 7) return "text-base sm:text-lg lg:text-2xl"
  return "text-xl sm:text-2xl lg:text-4xl"
}

type RelatedArtist = NonNullable<ArtistContext["relatedArtists"]>[number]

function SameVibeSection({
  artists,
  onSelectArtist,
}: {
  artists: RelatedArtist[]
  onSelectArtist: (artist: { id: string; name: string }) => void
}) {
  return (
    <div>
      <div className="mb-4 font-display text-xl uppercase tracking-[0.1em] text-black/80">
        Same Vibe
      </div>
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-1">
        {artists.map((artist, i) => (
          <button
            key={artist.name}
            type="button"
            aria-label={`View ${artist.name}`}
            onClick={() =>
              onSelectArtist({
                id: artist.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                name: artist.name.toUpperCase(),
              })
            }
            className="group relative aspect-square min-w-0 border border-black/50 shadow-md"
            style={{
              backgroundColor: SAME_VIBE_COLORS[i % SAME_VIBE_COLORS.length],
            }}
          >
            <div className="pointer-events-none absolute inset-0 border-[4px] border-white/80 sm:border-[5px]" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-multiply"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              }}
            />
            <div className="absolute inset-[7px] flex flex-col items-center justify-center overflow-hidden px-0.5 sm:inset-[8px]">
              {artist.name.toUpperCase().split(/\s+/).map((word, wi) => (
                <span
                  key={wi}
                  className={[
                    "block max-w-full font-display text-center leading-[0.95] tracking-[0.02em] text-black/85 transition group-hover:text-black",
                    sameVibeTextSize(artist.name),
                  ].join(" ")}
                  style={{
                    WebkitTextStroke: "0.5px rgba(255,255,255,0.4)",
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

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
  const relatedArtists = artistContext?.relatedArtists ?? []

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

  return (
    <div className="space-y-8 pb-10">
      <header>
        <h1 className="font-display text-5xl md:text-6xl font-normal tracking-[0.22em] leading-none text-black/80 uppercase">
          {selectedArtistName}
        </h1>
        {useCached && artistPage.data?.artist.tags && (
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
            {artistPage.data.artist.tags.map((tag, i) => (
              <span key={tag}>
                {i > 0 && "·"} {tag}
              </span>
            ))}
            {artistPage.data?.artist.artist_context?.city && (
              <span>· {artistPage.data.artist.artist_context.city}</span>
            )}
            {artistPage.data?.artist.artist_context?.yearsActive && (
              <span>· {artistPage.data.artist.artist_context.yearsActive}</span>
            )}
          </div>
        )}
      </header>

      <ArtistBio
        context={artistPage.data?.artist.artist_context ?? null}
        isLoading={isLoading}
      />

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
        <EmptyState
          message={`No concert videos found for ${selectedArtistName}.`}
        />
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

      {!error && !isLoading && activeVideo && (
        <>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-6">
            <div className="min-w-0 flex-[4] space-y-8">
              <section className="space-y-4" ref={heroRef}>
                <VideoHero video={activeVideo} />
              </section>

              {relatedArtists.length > 0 && (
                <div className="lg:hidden">
                  <SameVibeSection
                    artists={relatedArtists}
                    onSelectArtist={setSelectedArtist}
                  />
                </div>
              )}

              <ContentCards
                liveVideos={more}
                interviewVideos={interviewVideos}
                musicVideos={musicVideos}
                onSelectVideo={handleSelectVideo}
                watchedVideoIds={watchedVideoIds}
                allVideos={allVideos}
                selectedDecade={selectedDecade}
                onSelectDecade={setSelectedDecade}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMore}
              />
            </div>

            <aside className="w-full lg:flex-1 lg:shrink-0">
              <div className="hidden space-y-10 lg:block">
                {artistContext?.city && (
                  <ArtistLocationMap
                    city={artistContext.city}
                    colorIndex={0}
                  />
                )}

                {relatedArtists.length > 0 && (
                  <SameVibeSection
                    artists={relatedArtists}
                    onSelectArtist={setSelectedArtist}
                  />
                )}

                <MerchSidebar artistId={selectedArtistId} artistName={selectedArtistName} />
              </div>

              <div className="lg:hidden">
                <MerchSidebar artistId={selectedArtistId} artistName={selectedArtistName} />
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
