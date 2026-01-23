import { getLiveShowsForArtist } from "../data/liveShows"
import VideoHero from "../components/liveShows/VideoHero"
import VideoCard from "../components/liveShows/VideoCard"
import { ExternalLinkIcon, ShareIcon } from "../components/liveShows/Icons"

const ARTIST_ID = "the-smiths"
const ARTIST_NAME = "THE SMITHS"

export default function LiveShowsPage() {
  const { featured, more } = getLiveShowsForArtist(ARTIST_ID)

  return (
    <div className="w-full">
      {/* Artist header */}
      <header className="mx-auto mt-10 max-w-5xl text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-[0.18em] text-black/80">
          {ARTIST_NAME}
        </h1>
        <div className="mt-3 text-xs font-semibold uppercase tracking-[0.35em] text-black/55">
          Live Performances
        </div>
      </header>

      {/* Featured hero */}
      {featured ? <VideoHero show={featured} /> : null}

      {/* Complete Concert */}
      <section className="mx-auto mt-10 max-w-5xl px-4 pb-16">
        <div className="text-left">
          <div className="text-lg font-extrabold tracking-[0.12em] text-black/75">
            COMPLETE CONCERT
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-black/60">
            <div className="inline-flex items-center gap-2">
              <span className="text-lg">📍</span>
              <span className="font-medium">
                {featured?.venue}
                {featured?.city ? `, ${featured.city}` : ""}
              </span>
            </div>

            <div className="inline-flex items-center gap-2">
              <span className="text-lg">🗓️</span>
              <span className="font-medium">{featured?.year}</span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <a
              href={featured?.youtubeUrl ?? "https://www.youtube.com"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 border border-[#7a2d2b] bg-transparent px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#7a2d2b] hover:bg-[#7a2d2b]/5"
            >
              <ExternalLinkIcon className="h-5 w-5" />
              Watch on YouTube
            </a>

            {/* Share icon (non-functional) */}
            <button
              type="button"
              className="grid h-12 w-12 place-items-center text-black/55 hover:text-black/75"
              aria-label="Share"
              onClick={() => {}}
            >
              <ShareIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* More Live Sets */}
        <div className="mt-12">
          <div className="text-lg font-extrabold tracking-[0.12em] text-black/75">
            MORE LIVE SETS
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {more.map((s) => (
              <VideoCard key={s.id} show={s} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
