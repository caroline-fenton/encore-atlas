import { useOutletContext } from "react-router-dom"
import type { AppOutletContext } from "../layouts/AppLayout"
import { getLiveShowsForArtist } from "../data/liveShows"
import VideoHero from "../components/liveShows/VideoHero"
import VideoCard from "../components/liveShows/VideoCard"
import { ExternalLinkIcon, ShareIcon } from "../components/liveShows/Icons"
import { MapPin, Calendar } from "lucide-react"

export default function LiveShowsPage() {
  const { selectedArtistId, selectedArtistName } =
    useOutletContext<AppOutletContext>()

  const { featured, more } = getLiveShowsForArtist(selectedArtistId)

  const onShare = async () => {
    const url = featured?.youtubeUrl ?? window.location.href
    try {
      await navigator.clipboard.writeText(url)
      // optional: toast later
    } catch {
      // fallback
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
          Live Performances
        </div>
      </header>

      <section className="space-y-4">
        <VideoHero
          videoId="5lMXA1r6GMM"
          duration={featured?.duration ?? "1:18:00"}
        />

        <div className="py-4">
          <div className="font-display text-2xl tracking-[0.12em] text-black/75">
            COMPLETE CONCERT
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 font-typewriter text-black/60">
            <div className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>
                {featured?.venue}
                {featured?.city ? `, ${featured.city}` : ""}
              </span>
            </div>

            <div className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{featured?.year}</span>
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

      <section className="space-y-4">
        <div className="font-display text-2xl tracking-[0.12em] text-black/75">
          MORE LIVE SETS
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {more.map((s) => (
            <VideoCard key={s.id} show={s} />
          ))}
        </div>
      </section>
    </div>
  )
}
