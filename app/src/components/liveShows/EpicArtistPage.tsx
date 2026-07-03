import ArtistBio from "../shared/ArtistBio"
import MerchSidebar from "../shared/MerchSidebar"
import ContentCards from "./ContentCards"
import type { ArtistPageLayoutProps } from "./ArtistPageLayoutTypes"
import SameVibeSection from "./SameVibeSection"
import VideoHero from "./VideoHero"

function metaItems(items: Array<{ label: string; value: string | null | undefined }>) {
  return items.filter((item): item is { label: string; value: string } =>
    Boolean(item.value?.trim())
  )
}

export default function EpicArtistPage({
  artistId,
  artistName,
  tags,
  bioImageUrl,
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
  const epic = context?.epicTemplate
  const backgroundImage = epic?.heroImageUrl || bioImageUrl || activeVideo.thumbnailUrl
  const introCopy = epic?.introCopy || context?.sceneSummary || null
  const details = metaItems([
    { label: "Featured era", value: epic?.featuredEra },
    { label: "Live moment", value: epic?.featuredLiveMoment },
    { label: "Origin", value: city },
    { label: "Active years", value: yearsActive },
  ])

  return (
    <div className="-mx-4 -mt-6 pb-10 sm:-mx-6 lg:-mx-8">
      <section className="relative isolate overflow-hidden bg-[#171412] px-4 pb-8 pt-10 text-white sm:px-6 sm:pt-14 lg:px-8">
        {backgroundImage ? (
          <img
            src={backgroundImage}
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover opacity-45"
          />
        ) : (
          <div className="absolute inset-0 -z-20 bg-[#171412]" />
        )}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,rgba(12,10,8,0.94),rgba(12,10,8,0.68)_48%,rgba(217,79,67,0.24))]" />
        <div className="absolute inset-y-0 left-0 -z-10 w-full bg-[linear-gradient(90deg,rgba(9,7,6,0.88),rgba(9,7,6,0.42)_42%,transparent_72%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-44 bg-[linear-gradient(to_top,rgba(9,7,6,0.86),transparent)]" />

        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.55fr)] lg:items-end">
          <div className="space-y-5">
            <div className="inline-flex border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              Epic Artist
            </div>
            <div>
              <h1 className="font-display text-5xl font-normal uppercase leading-[0.9] tracking-[0.18em] text-white sm:text-6xl lg:text-7xl">
                {artistName}
              </h1>
              {epic?.tagline && (
                <p className="mt-4 max-w-xl text-base font-semibold uppercase tracking-[0.14em] text-[#c2d44a] sm:text-lg">
                  {epic.tagline}
                </p>
              )}
            </div>

            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
                {tags.slice(0, 5).map((tag) => (
                  <span key={tag} className="border border-white/20 bg-black/20 px-2 py-1">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {details.length > 0 && (
              <div className="grid gap-3 text-xs uppercase tracking-[0.12em] text-white/78 sm:grid-cols-2">
                {details.map((detail) => (
                  <div key={`${detail.label}:${detail.value}`} className="border-l-2 border-[#d94f43] pl-3">
                    <div className="text-[9px] font-semibold tracking-[0.18em] text-white/45">
                      {detail.label}
                    </div>
                    <div className="mt-1 text-white/82">
                      {detail.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {introCopy && (
              <p className="max-w-2xl text-sm font-medium leading-relaxed text-white/88 drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
                {introCopy}
              </p>
            )}
          </div>

          <section ref={heroRef} className="relative">
            <div className="mb-3 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
              <span>Featured Live Moment</span>
              {activeVideo.duration && <span>{activeVideo.duration}</span>}
            </div>
            <VideoHero video={activeVideo} />
          </section>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 pt-8 sm:px-6 lg:px-8">
        {!introCopy && <ArtistBio context={context} isLoading={false} />}

        {relatedArtists.length > 0 && (
          <SameVibeSection
            artists={relatedArtists}
            onSelectArtist={onSelectArtist}
            className="lg:hidden"
          />
        )}

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-6">
          <div className="min-w-0 flex-[4] space-y-8">
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
      </div>
    </div>
  )
}
