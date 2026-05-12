import type { ArtistContext } from "../../services/artistPage"

type Props = {
  context: ArtistContext | null
  isLoading: boolean
}

export default function ArtistBio({ context, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-black/10" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-black/10" />
        <div className="h-4 w-full animate-pulse rounded bg-black/8" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-black/8" />
      </div>
    )
  }

  if (!context?.sceneSummary) return null

  const meta = [context.city, context.yearsActive].filter(Boolean).join(" · ")

  return (
    <div className="space-y-2">
      {meta && (
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/40">
          {meta}
        </div>
      )}
      <p className="font-sans text-sm leading-relaxed text-black/65">
        {context.sceneSummary}
      </p>
      {context.knownFor.length > 0 && (
        <p className="text-[11px] text-black/40">
          {context.knownFor.join(" · ")}
        </p>
      )}
    </div>
  )
}
