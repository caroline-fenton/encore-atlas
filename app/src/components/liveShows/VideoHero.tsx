import type { Video } from "../../types/video"

type Props = {
  video: Video
}

export default function VideoHero({ video }: Props) {
  return (
    <div className="relative w-full border border-black/50 shadow-md">
      {/* White inset border */}
      <div className="absolute inset-0 border-[4px] border-white/80 z-10 pointer-events-none" />
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
