import { useOutletContext } from "react-router-dom"
import { useRef, useState, useEffect, useCallback } from "react"
import type { AppOutletContext } from "../layouts/AppLayout"
import type { Video } from "../types/video"
import { useArtistConcerts } from "../hooks/useVideos"
import VideoHero from "../components/liveShows/VideoHero"
import VideoCard from "../components/liveShows/VideoCard"
import VideoHeroSkeleton from "../components/shared/VideoHeroSkeleton"
import VideoCardSkeleton from "../components/shared/VideoCardSkeleton"
import ErrorState from "../components/shared/ErrorState"
import EmptyState from "../components/shared/EmptyState"

export default function LiveShowsPage() {
  const { selectedArtistName } = useOutletContext<AppOutletContext>()

  const { featured, more, isLoading, isLoadingMore, error, hasMore, loadMore, retry } =
    useArtistConcerts(selectedArtistName)

  const [nowPlaying, setNowPlaying] = useState<Video | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)

  // Reset nowPlaying when featured video changes (new artist selected)
  useEffect(() => {
    setNowPlaying(null)
  }, [featured?.id])

  const activeVideo = nowPlaying ?? featured

  const handleSelectVideo = useCallback((video: Video) => {
    setNowPlaying(video)
    heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])


  return (
    <div className="space-y-8 pb-10">
      <header className="text-center">
        <h1 className="font-display text-5xl md:text-6xl font-normal tracking-[0.22em] leading-none text-black/80 uppercase">
          {selectedArtistName}
        </h1>
        <div className="mt-3 font-typewriter text-xs uppercase tracking-[0.35em] text-black/55">
          Live Performances
        </div>
      </header>

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

      {!error && !isLoading && !featured && (
        <EmptyState message={`No concert videos found for ${selectedArtistName}.`} />
      )}

      {!error && !isLoading && activeVideo && (
        <>
          <section className="space-y-4" ref={heroRef}>
            <VideoHero video={activeVideo} />

            <div className="py-4">
              <div className="font-display text-2xl tracking-[0.12em] text-black/75">
                {activeVideo.title}
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
