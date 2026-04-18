type Props = {
  artistName: string
}

export default function BuildingState({ artistName }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* Animated pulsing rings */}
      <div className="relative mb-8">
        <div className="h-16 w-16 animate-ping rounded-full bg-[#7a2d2b]/10" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-[#7a2d2b]/20" />
        <div className="absolute inset-4 rounded-full bg-[#7a2d2b]/30" />
      </div>

      <div className="font-display text-lg tracking-[0.15em] text-black/70 uppercase">
        Building this artist's concert page
      </div>

      <div className="mt-3 max-w-sm text-sm leading-relaxed text-black/45">
        Searching for {artistName}'s best live performances and generating
        tags. This only happens once — every future visitor gets this page
        instantly.
      </div>

      <div className="mt-6 flex items-center gap-2">
        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7a2d2b]/40 [animation-delay:0ms]" />
        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7a2d2b]/40 [animation-delay:150ms]" />
        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7a2d2b]/40 [animation-delay:300ms]" />
      </div>
    </div>
  )
}
