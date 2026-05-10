import type { Video } from "../../types/video"

type Props = {
  video: Video
  onSelect: (video: Video) => void
  isWatched?: boolean
}

export default function VideoCard({ video, onSelect, isWatched = false }: Props) {
  const meta = video.venue
    ? video.city
      ? `${video.venue}\n${video.city} · ${video.year}`
      : `${video.venue} · ${video.year}`
    : null

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
        {isWatched && (
          <div className="absolute left-2 top-2 bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/90">
            Watched
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="text-[13px] font-semibold tracking-[0.02em] text-black/80">
          {video.title}
          {video.duration && (
            <span className="ml-2 text-[11px] font-normal text-black/40">{video.duration}</span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-black/40">{video.channelTitle}</div>
        {meta && (
          <div className="mt-1 whitespace-pre-line text-sm leading-5 text-black/55">{meta}</div>
        )}
      </div>
    </button>
  )
}
