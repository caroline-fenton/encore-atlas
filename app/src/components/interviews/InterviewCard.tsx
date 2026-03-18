import DurationBadge from "../liveShows/DurationBadge"
import { Share2 } from "lucide-react"
import type { Video } from "../../types/video"

type Props = {
  video: Video
  onSelect: (video: Video) => void
}

export default function InterviewCard({ video, onSelect }: Props) {
  const onShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(video.youtubeUrl)
    } catch {
      window.prompt("Copy link:", video.youtubeUrl)
    }
  }

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

      <div className="flex flex-1 items-start gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-[0.02em] text-black/80 line-clamp-2">
            {video.title}
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          className="mt-1 text-black/35 hover:text-black/60"
          onClick={onShare}
          onKeyDown={(e) => { if (e.key === "Enter") onShare(e as unknown as React.MouseEvent) }}
          aria-label="Share"
        >
          <Share2 className="h-4.5 w-4.5" />
        </div>
      </div>
    </button>
  )
}
