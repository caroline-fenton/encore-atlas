import { useOutletContext } from "react-router-dom"
import { useRef, useState, useCallback } from "react"
import type { AppOutletContext } from "../layouts/AppLayout"
import type { Video } from "../types/video"
import { useArtistConcerts } from "../hooks/useVideos"
import { useArtistPage } from "../hooks/useArtistPage"
import { useArtistBio } from "../hooks/useArtistBio"
import { useDecadeFilter } from "../hooks/useDecadeFilter"
import { useWatchHistory } from "../hooks/useWatchHistory"
import ArtistBio from "../components/shared/ArtistBio"
import DecadeFilter from "../components/shared/DecadeFilter"
import VideoHero from "../components/liveShows/VideoHero"
import VideoCard from "../components/liveShows/VideoCard"
import VideoHeroSkeleton from "../components/shared/VideoHeroSkeleton"
import VideoCardSkeleton from "../components/shared/VideoCardSkeleton"
import ErrorState from "../components/shared/ErrorState"
import EmptyState from "../components/shared/EmptyState"
import BuildingState from "../components/shared/BuildingState"

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
  }[],
): Video[] {
  return videos.map((v) => ({
    id: v.youtube_video_id,
    title: v.title,
    channelTitle: "",
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
  const { selectedArtistName, user, waitForAuth } =
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

  const { bio, isLoading: bioLoading } = useArtistBio(selectedArtistName)
  const { filtered, selectedDecade, setSelectedDecade } = useDecadeFilter(
    allVideos,
    selectedArtistName,
  )

  const featured = filtered.length > 0 ? filtered[0] : null
  const more = filtered.length > 1 ? filtered.slice(1) : []

  const [nowPlaying, setNowPlaying] = useState<Video | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const resetKey = `${featured?.id}::${selectedDecade}`
  const [prevResetKey, setPrevResetKey] = useState(resetKey)

  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey)
    setNowPlaying(null)
  }

  const activeVideo = nowPlaying ?? featured

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
        <header className="text-center">
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
      <header className="text-center">
        <h1 className="font-display text-5xl md:text-6xl font-normal tracking-[0.22em] leading-none text-black/80 uppercase">
          {selectedArtistName}
        </h1>
        <div className="mt-3 font-typewriter text-xs uppercase tracking-[0.35em] text-black/55">
          Live Performances
        </div>
        {useCached && artistPage.data?.artist.tags && (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {artistPage.data.artist.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-black/10 bg-white/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <ArtistBio bio={bio} isLoading={bioLoading} />

      {!isLoading && allVideos.length > 0 && (
        <DecadeFilter
          videos={allVideos}
          selected={selectedDecade}
          onSelect={setSelectedDecade}
        />
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
            className="inline-flex items-center gap-2 border border-stone-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/60 hover:border-[#7a2d2b]/30 hover:text-[#7a2d2b] disabled:opacity-50"
          >
            {isLoadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {!error && !isLoading && activeVideo && (
        <>
          <section className="space-y-4" ref={heroRef}>
            <VideoHero video={activeVideo} />

            <div className="py-4">
              <div className="font-display text-2xl tracking-[0.12em] text-black/75">
                {activeVideo.title}
              </div>
              <div className="mt-1 text-xs text-black/40">
                {activeVideo.channelTitle}
              </div>
            </div>
          </section>

          {(more.length > 0 || hasMore) && (
            <section className="space-y-4">
              {more.length > 0 && (
                <>
                  <div className="font-display text-2xl tracking-[0.12em] text-black/75">
                    MORE LIVE SETS
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {more.map((v) => (
                      <VideoCard
                        key={v.id}
                        video={v}
                        onSelect={handleSelectVideo}
                        isWatched={watchedVideoIds.has(v.id)}
                      />
                    ))}
                  </div>
                </>
              )}

              {hasMore && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-2 border border-stone-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/60 hover:border-[#7a2d2b]/30 hover:text-[#7a2d2b] disabled:opacity-50"
                  >
                    {isLoadingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
