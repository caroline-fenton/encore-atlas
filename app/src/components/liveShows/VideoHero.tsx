export default function VideoHero({ imageUrl, duration }: { imageUrl: string; duration: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-md border border-black/20 bg-black/5 aspect-[16/7]">
      <img
        src={imageUrl}
        alt=""
        className="h-full w-full object-cover"
      />

      {/* play button + duration badge can sit on top */}
      <div className="absolute right-3 top-3 rounded-sm border border-black/20 bg-[#f6f1e8]/90 px-2 py-1 text-xs tracking-wide">
        {duration}
      </div>
    </div>
  )
}
