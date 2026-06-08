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

  return (
    <div>
      <p className="font-sans text-sm leading-relaxed text-black/65">
        {context.sceneSummary}
      </p>
    </div>
  )
}
