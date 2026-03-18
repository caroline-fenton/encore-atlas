import DurationBadge from "../liveShows/DurationBadge"
import type { Video } from "../../types/video"

type Props = {
  video: Video
  onSelect: (video: Video) => void
}

export default function InterviewCard({ video, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(video)}
      className="flex w-full overflow-hidden rounded-lg border border-black/10 bg-white/45 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:bg-white/60"
    >
      <div className="relative h-[96px] w-[156px] shrink-0 overflow-hidden bg-black/5">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute bottom-2 right-2">
          <DurationBadge
            value={video.duration}
            className="border border-black/10 bg-white/80 text-black/70"
          />
        </div>
      </div>

      <div className="flex flex-1 items-center px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-[0.02em] text-black/80 line-clamp-2">
            {video.title}
          </div>
        </div>
      </div>
    </button>
  )
}
