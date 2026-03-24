import { useState } from "react"
import type { ArtistBio as ArtistBioType } from "../../services/wikipedia"

const COLLAPSED_LENGTH = 200

export default function ArtistBio({
  bio,
  isLoading,
}: {
  bio: ArtistBioType | null
  isLoading: boolean
}) {
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

  const isLong = bio.extract.length > COLLAPSED_LENGTH
  const displayText =
    isLong && !expanded
      ? bio.extract.slice(0, COLLAPSED_LENGTH).replace(/\s+\S*$/, "") + "..."
      : bio.extract

  return (
    <div className="flex items-start gap-5">
      {bio.thumbnailUrl && (
        <img
          src={bio.thumbnailUrl}
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
        <a
          href={bio.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block font-typewriter text-[10px] uppercase tracking-[0.25em] text-black/35 hover:text-black/55"
        >
          Source: Wikipedia
        </a>
      </div>
    </div>
  )
}
