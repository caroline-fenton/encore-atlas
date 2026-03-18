import { useOutletContext } from "react-router-dom"
import { useRef, useState, useCallback } from "react"
import type { AppOutletContext } from "../layouts/AppLayout"
import type { Video } from "../types/video"
import { useArtistInterviews } from "../hooks/useVideos"
import VideoHero from "../components/liveShows/VideoHero"
import InterviewCard from "../components/interviews/InterviewCard"
import VideoCardSkeleton from "../components/shared/VideoCardSkeleton"
import ErrorState from "../components/shared/ErrorState"
import EmptyState from "../components/shared/EmptyState"
import { ExternalLinkIcon, ShareIcon } from "../components/liveShows/Icons"

export default function InterviewsPage() {
  const { selectedArtistName } = useOutletContext<AppOutletContext>()

  const { videos, isLoading, error, retry } =
    useArtistInterviews(selectedArtistName)

  const [nowPlaying, setNowPlaying] = useState<Video | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)

  const handleSelectVideo = useCallback((video: Video) => {
    setNowPlaying(video)
    heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const onShare = async () => {
    const url = nowPlaying?.youtubeUrl ?? window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt("Copy link:", url)
    }
  }

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

                <div className="mt-2 font-typewriter text-black/60">
                  {nowPlaying.channelTitle} · {new Date(nowPlaying.publishedAt).getFullYear()}
                </div>

                <div className="mt-5 flex items-center gap-4">
                  <a
                    href={nowPlaying.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-3 border border-[#7a2d2b] bg-transparent px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#7a2d2b] hover:bg-[#7a2d2b]/5"
                  >
                    <ExternalLinkIcon className="h-5 w-5" />
                    Watch on YouTube
                  </a>

                  <button
                    type="button"
                    className="grid h-12 w-12 place-items-center text-black/55 hover:text-black/75"
                    aria-label="Share"
                    onClick={onShare}
                  >
                    <ShareIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="space-y-4">
            {!nowPlaying && (
              <div className="font-typewriter text-xs uppercase tracking-[0.25em] text-black/45 text-center">
                Select an interview to watch
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {videos.map((v) => (
                <InterviewCard
                  key={v.id}
                  video={v}
                  onSelect={handleSelectVideo}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
