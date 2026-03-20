export default function VideoCardSkeleton() {
  return (
    <div className="flex overflow-hidden rounded-lg border border-black/10 bg-white/45">
      <div className="h-[96px] w-[156px] shrink-0 animate-pulse bg-black/10" />
      <div className="flex flex-1 flex-col justify-center px-5 py-4 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-black/10" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-black/8" />
      </div>
    </div>
  )
}
