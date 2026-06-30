import type { ArtistContext } from "../../services/artistPage"

const SAME_VIBE_COLORS = [
  "#d94f43", "#4db8e8", "#c2d44a", "#3580b0",
  "#f07cbf", "#5a9a6e", "#eba264", "#9256a8",
  "#6fd4a2", "#a8612e", "#62d4eb", "#b0456a",
]

function sameVibeTextSize(name: string): string {
  const longestWord = Math.max(...name.split(/\s+/).map((word) => word.length))

  if (longestWord > 12) return "text-[11px] sm:text-xs lg:text-base"
  if (longestWord > 10) return "text-xs sm:text-sm lg:text-lg"
  if (longestWord > 7) return "text-base sm:text-lg lg:text-2xl"
  return "text-xl sm:text-2xl lg:text-4xl"
}

type RelatedArtist = NonNullable<ArtistContext["relatedArtists"]>[number]

type Props = {
  artists: RelatedArtist[]
  onSelectArtist: (artist: { id: string; name: string }) => void
  className?: string
}

export default function SameVibeSection({
  artists,
  onSelectArtist,
  className = "",
}: Props) {
  return (
    <div className={className}>
      <div className="mb-4 font-display text-xl uppercase tracking-[0.1em] text-black/80">
        Same Vibe
      </div>
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-1">
        {artists.map((artist, i) => (
          <button
            key={artist.name}
            type="button"
            aria-label={`View ${artist.name}`}
            onClick={() =>
              onSelectArtist({
                id: artist.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                name: artist.name.toUpperCase(),
              })
            }
            className="group relative aspect-square min-w-0 border border-black/50 shadow-md"
            style={{
              backgroundColor: SAME_VIBE_COLORS[i % SAME_VIBE_COLORS.length],
            }}
          >
            <div className="pointer-events-none absolute inset-0 border-[4px] border-white/80 sm:border-[5px]" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-multiply"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              }}
            />
            <div className="absolute inset-[7px] flex flex-col items-center justify-center overflow-hidden px-0.5 sm:inset-[8px]">
              {artist.name.toUpperCase().split(/\s+/).map((word, wi) => (
                <span
                  key={wi}
                  className={[
                    "block max-w-full font-display text-center leading-[0.95] tracking-[0.02em] text-black/85 transition group-hover:text-black",
                    sameVibeTextSize(artist.name),
                  ].join(" ")}
                  style={{
                    WebkitTextStroke: "0.5px rgba(255,255,255,0.4)",
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
