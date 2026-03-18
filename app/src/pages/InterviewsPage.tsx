import { useOutletContext } from "react-router-dom"
import { useRef, useState, useEffect, useCallback } from "react"
import type { AppOutletContext } from "../layouts/AppLayout"
import type { Video } from "../types/video"
import { useArtistInterviews } from "../hooks/useVideos"
import VideoHero from "../components/liveShows/VideoHero"
import InterviewCard from "../components/interviews/InterviewCard"
import VideoCardSkeleton from "../components/shared/VideoCardSkeleton"
import ErrorState from "../components/shared/ErrorState"
import EmptyState from "../components/shared/EmptyState"

export default function InterviewsPage() {
  const { selectedArtistName } = useOutletContext<AppOutletContext>()

  const { videos, isLoading, isLoadingMore, error, hasMore, loadMore, retry } =
    useArtistInterviews(selectedArtistName)

  const [nowPlaying, setNowPlaying] = useState<Video | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)

  // Reset selected interview when artist changes
  useEffect(() => {
    setNowPlaying(null)
  }, [selectedArtistName])

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
          In Their Own Words
        </div>
      </header>

      {error && <ErrorState message={error} onRetry={retry} />}

      {!error && isLoading && (
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!error && !isLoading && videos.length === 0 && (
        <EmptyState message={`No interviews found for ${selectedArtistName}.`} />
      )}

      {!error && !isLoading && videos.length > 0 && (
        <>
          {nowPlaying && (
            <section className="space-y-4" ref={heroRef}>
              <VideoHero video={nowPlaying} />

              <div className="py-4">
                <div className="font-display text-2xl tracking-[0.12em] text-black/75">
                  {nowPlaying.title}
                </div>

              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {videos.map((v) => (
                <InterviewCard
                  key={v.id}
                  video={v}
                  onSelect={handleSelectVideo}
                />
              ))}
            </div>

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
        </>
      )}
    </div>
  )
}
