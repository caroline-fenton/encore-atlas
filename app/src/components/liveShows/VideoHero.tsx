import DurationBadge from "./DurationBadge"
import { PlayIcon } from "./Icons"
import type { LiveShow } from "../../types/liveShows"

type Props = {
  show: LiveShow
}

export default function VideoHero({ show }: Props) {
  return (
    <div className="mx-auto mt-8 w-full max-w-5xl">
      <div className="relative overflow-hidden border border-black/20 bg-white/40">
        <img
          src={show.thumbnailUrl}
          alt={show.title}
          className="h-[360px] w-full object-cover md:h-[420px]"
        />

        <div className="absolute left-6 top-6">
          <div className="inline-flex items-center rounded-sm bg-[#7a2d2b] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
            Featured
          </div>
        </div>

        <div className="absolute right-6 top-6">
          <DurationBadge value={show.duration} className="bg-white/80" />
        </div>

        <div className="absolute inset-0 grid place-items-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-[#7a2d2b]/90">
            <PlayIcon className="h-10 w-10 text-white" />
          </div>
        </div>
      </div>
    </div>
  )
}
