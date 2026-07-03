import type { ArtistContext } from "../../services/artistPage"

const SAME_VIBE_COLORS = [
  "#d94f43", "#4db8e8", "#c2d44a", "#3580b0",
  "#f07cbf", "#5a9a6e", "#eba264", "#9256a8",
  "#6fd4a2", "#a8612e", "#62d4eb", "#b0456a",
]

function artistSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function artistInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "EA"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
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
            className="group relative min-h-32 min-w-0 overflow-hidden border border-black/55 bg-white/50 p-2 text-left shadow-[3px_3px_0_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60 lg:min-h-28"
            style={{
              backgroundColor: SAME_VIBE_COLORS[i % SAME_VIBE_COLORS.length],
            }}
          >
            <div className="pointer-events-none absolute inset-1 border border-white/70" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-multiply"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              }}
            />
            <div className="pointer-events-none absolute -right-7 -top-7 h-24 w-24 rounded-full border border-black/20 bg-black/78 shadow-inner transition group-hover:rotate-12 sm:h-28 sm:w-28 lg:h-24 lg:w-24">
              <div className="absolute inset-3 rounded-full border border-white/10" />
              <div className="absolute inset-6 rounded-full border border-white/10" />
              <div className="absolute inset-9 rounded-full bg-white/85" />
              <div className="absolute inset-[42%] rounded-full bg-black/70" />
            </div>
            <div className="relative flex min-h-[7rem] flex-col justify-between lg:min-h-24">
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-[10px] font-semibold text-black/45">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-7 mr-7 flex h-9 w-9 items-center justify-center rounded-full border border-black/20 bg-white/75 font-display text-xl leading-none text-black/70 shadow-sm sm:mt-8 sm:mr-8 lg:mt-7 lg:mr-7">
                  {artistInitials(artist.name)}
                </span>
              </div>
              <div className="max-w-[82%] border border-black/25 bg-[#f6f1e8]/88 px-2.5 py-2 shadow-[2px_2px_0_rgba(255,255,255,0.32)] lg:max-w-[84%]">
                <span className="block break-words font-display text-[1.55rem] uppercase leading-[0.92] text-black/86 transition group-hover:text-black">
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
