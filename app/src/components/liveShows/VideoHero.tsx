import type { Video } from "../../types/video"

type Props = {
  video: Video
}

export default function VideoHero({ video }: Props) {
  return (
    <div className="relative w-full overflow-hidden border border-black/10 bg-white/35 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
      <div className="aspect-video w-full bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${video.id}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    </div>
  )
}
