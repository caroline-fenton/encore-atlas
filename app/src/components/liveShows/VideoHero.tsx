export default function VideoHero({
  videoId,
  duration,
}: {
  videoId: string
  duration: string
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-black/10 bg-white/35 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
      <div className="aspect-video w-full bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>

      {/* duration pill */}
      <div className="absolute right-4 top-4 rounded-full border border-black/10 bg-[#f6f1e8]/90 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-black/65 backdrop-blur">
        {duration}
      </div>
    </div>
  )
}
