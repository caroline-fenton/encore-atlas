import DurationBadge from "./DurationBadge"
import type { LiveShow } from "../../types/liveShows"

type Props = {
  show: LiveShow
}

export default function VideoCard({ show }: Props) {
  const meta = show.city
    ? `${show.venue}\n${show.city} · ${show.year}`
    : `${show.venue} · ${show.year}`

  return (
    <a
      href={show.youtubeUrl}
      target="_blank"
      rel="noreferrer"
      className="block"
    >
      <div className="group flex overflow-hidden rounded-lg border border-black/10 bg-white/45 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:bg-white/60">
        <div className="relative h-[96px] w-[156px] shrink-0 overflow-hidden bg-black/5">
          <img
            src={show.thumbnailUrl}
            alt={show.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />

          <div className="absolute bottom-2 right-2">
            <DurationBadge
              value={show.duration}
              className="border border-black/10 bg-white/80 text-black/70"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center px-5 py-4">
          <div className="text-[15px] font-semibold tracking-[0.02em] text-black/80">
            {show.title}
          </div>

          <div className="mt-1 whitespace-pre-line text-sm leading-5 text-black/55">
            {meta}
          </div>
        </div>
      </div>
    </a>
  )
}
