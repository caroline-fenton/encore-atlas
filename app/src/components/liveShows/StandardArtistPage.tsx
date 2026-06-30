import ArtistBio from "../shared/ArtistBio"
import MerchSidebar from "../shared/MerchSidebar"
import ContentCards from "./ContentCards"
import type { ArtistPageLayoutProps } from "./ArtistPageLayoutTypes"
import SameVibeSection from "./SameVibeSection"
import VideoHero from "./VideoHero"

export default function StandardArtistPage({
  artistId,
  artistName,
  tags,
  city,
  yearsActive,
  context,
  activeVideo,
  moreVideos,
  interviewVideos,
  musicVideos,
  allVideos,
  watchedVideoIds,
  relatedArtists,
  selectedDecade,
  hasMore,
  isLoadingMore,
  heroRef,
  onSelectArtist,
  onSelectVideo,
  onSelectDecade,
  onLoadMore,
}: ArtistPageLayoutProps) {
  return (
    <>
      <header>
        <h1 className="font-display text-5xl md:text-6xl font-normal tracking-[0.22em] leading-none text-black/80 uppercase">
          {artistName}
        </h1>
        {tags && (
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50">
            {tags.map((tag, i) => (
              <span key={tag}>
                {i > 0 && <>&middot;</>} {tag}
              </span>
            ))}
            {city && <span>&middot; {city}</span>}
            {yearsActive && <span>&middot; {yearsActive}</span>}
          </div>
        )}
      </header>

      <ArtistBio context={context} isLoading={false} />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-6">
        <div className="min-w-0 flex-[4] space-y-8">
          <section className="space-y-4" ref={heroRef}>
            <VideoHero video={activeVideo} />
          </section>

          {relatedArtists.length > 0 && (
            <SameVibeSection
              artists={relatedArtists}
              onSelectArtist={onSelectArtist}
              className="lg:hidden"
            />
          )}

          <ContentCards
            liveVideos={moreVideos}
            interviewVideos={interviewVideos}
            musicVideos={musicVideos}
            onSelectVideo={onSelectVideo}
            watchedVideoIds={watchedVideoIds}
            allVideos={allVideos}
            selectedDecade={selectedDecade}
            onSelectDecade={onSelectDecade}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
          />
        </div>

        <aside className="w-full lg:flex-1 lg:shrink-0">
          <div className="hidden space-y-10 lg:block">
            {relatedArtists.length > 0 && (
              <SameVibeSection
                artists={relatedArtists}
                onSelectArtist={onSelectArtist}
              />
            )}

            <MerchSidebar artistId={artistId} artistName={artistName} />
          </div>

          <div className="lg:hidden">
            <MerchSidebar artistId={artistId} artistName={artistName} />
          </div>
        </aside>
      </div>
    </>
  )
}
