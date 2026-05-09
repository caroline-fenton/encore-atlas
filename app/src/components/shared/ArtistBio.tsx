import { useState } from "react"

const COLLAPSED_LENGTH = 200

export type ArtistBioProps = {
  bio: string | null
  imageUrl?: string | null
  isLoading: boolean
}

export default function ArtistBio({ bio, imageUrl, isLoading }: ArtistBioProps) {
  const [expanded, setExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-start gap-5">
        <div className="hidden sm:block h-20 w-20 shrink-0 animate-pulse rounded-full bg-black/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-black/10" />
          <div className="h-4 w-full animate-pulse rounded bg-black/8" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-black/8" />
        </div>
      </div>
    )
  }

  if (!bio) return null

  const isLong = bio.length > COLLAPSED_LENGTH
  const displayText =
    isLong && !expanded
      ? bio.slice(0, COLLAPSED_LENGTH).replace(/\s+\S*$/, "") + "..."
      : bio

  return (
    <div className="flex items-start gap-5">
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="hidden sm:block h-20 w-20 shrink-0 rounded-full object-cover"
        />
      )}
      <div className="flex-1">
        <p className="font-typewriter text-sm leading-relaxed text-black/65">
          {displayText}
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="ml-1 text-[#7a2d2b] hover:text-[#7a2d2b]/70"
            >
              {expanded ? "Less" : "More"}
            </button>
          )}
        </p>
      </div>
    </div>
  )
}
