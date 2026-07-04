import type { ArtistContext } from "../../services/artistPage"

const SAME_VIBE_COLORS = [
  "#d94f43", "#4db8e8", "#c2d44a", "#3580b0",
  "#f07cbf", "#5a9a6e", "#eba264", "#9256a8",
  "#6fd4a2", "#a8612e", "#62d4eb", "#b0456a",
]

function artistSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-1">
        {artists.map((artist, i) => (
          <button
            key={artist.name}
            type="button"
            aria-label={`View ${artist.name}`}
            onClick={() =>
              onSelectArtist({
                id: artistSlug(artist.name),
                name: artist.name.toUpperCase(),
              })
            }
            className="group relative aspect-square min-w-0 overflow-hidden border border-black/35 bg-white/50 p-3 text-left transition hover:-translate-y-0.5 hover:border-black/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
            style={{
              backgroundColor: SAME_VIBE_COLORS[i % SAME_VIBE_COLORS.length],
            }}
          >
            <div className="pointer-events-none absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-100" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              }}
            />
            <div className="relative flex h-full items-end">
              <div className="w-full border-l-2 border-black/28 bg-[#f6f1e8]/90 px-3 py-2">
                <span className="block break-words font-display text-[1.35rem] uppercase leading-[0.92] text-black/86 transition group-hover:text-black sm:text-[1.45rem] lg:text-[1.35rem]">
                  {artist.name}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
