import DurationBadge from "./DurationBadge"
import type { LiveShow } from "../../types/liveShows"

type Props = {
  show: LiveShow
}

export default function VideoCard({ show }: Props) {
  return (
    <div className="flex overflow-hidden border border-black/20 bg-white/35">
      <div className="relative h-[92px] w-[140px] shrink-0">
        <img
          src={show.thumbnailUrl}
          alt={show.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute bottom-2 right-2">
          <DurationBadge value={show.duration} className="bg-white/75" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-4 py-3">
        <div className="text-base font-semibold tracking-wide text-black/85">
          {show.title}
        </div>
        <div className="text-sm text-black/60">
          {show.venue}
          {show.city ? `\n${show.city} · ${show.year}` : ` · ${show.year}`}
        </div>
      </div>
    </div>
  )
}
