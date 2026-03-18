export default function VideoHeroSkeleton() {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-black/10 bg-white/35 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
      <div className="aspect-video w-full animate-pulse bg-black/10" />
      <div className="absolute right-4 top-4 h-6 w-16 animate-pulse rounded-full bg-black/10" />
    </div>
  )
}
