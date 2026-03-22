import DurationBadge from "./DurationBadge"
import type { Video } from "../../types/video"

type Props = {
  video: Video
  onSelect: (video: Video) => void
}

export default function VideoCard({ video, onSelect }: Props) {
  // Curated content has venue/city/year. Search results show no extra meta.
  const meta = video.venue
    ? video.city
      ? `${video.venue}\n${video.city} · ${video.year}`
      : `${video.venue} · ${video.year}`
    : null

  return (
    <button
      type="button"
      onClick={() => onSelect(video)}
      className="block w-full text-left"
    >
      <div className="group flex overflow-hidden rounded-lg border border-black/10 bg-white/45 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:bg-white/60">
        <div className="relative h-[96px] w-[156px] max-w-[40%] shrink-0 overflow-hidden bg-black/5">
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />

          <div className="absolute bottom-2 right-2">
            <DurationBadge
              value={video.duration}
              className="border border-black/10 bg-white/80 text-black/70"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center px-5 py-4">
          <div className="text-[15px] font-semibold tracking-[0.02em] text-black/80">
            {video.title}
          </div>

          {meta && (
            <div className="mt-1 whitespace-pre-line text-sm leading-5 text-black/55">
              {meta}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
