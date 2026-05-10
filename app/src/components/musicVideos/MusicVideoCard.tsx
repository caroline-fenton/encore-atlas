import type { Video } from "../../types/video"
import { decodeHtml } from "../../utils/decodeHtml"

type Props = {
  video: Video
  onSelect: (video: Video) => void
}

export default function MusicVideoCard({ video, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(video)}
      className="group block w-full text-left"
    >
      <div className="relative overflow-hidden bg-black/5">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
      </div>

      <div className="mt-2">
        <div className="text-[13px] font-semibold tracking-[0.02em] text-black/80">
          {decodeHtml(video.title)}
          {video.duration && (
            <span className="ml-2 text-[11px] font-normal text-black/35">{video.duration}</span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-black/35">{video.channelTitle}</div>
      </div>
    </button>
  )
}
