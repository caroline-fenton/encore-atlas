import type { Recommendation } from "../../services/recommendations"
import type { ArtistContext } from "../../services/artistPage"

type Props = {
  recommendations: Recommendation[]
  relatedArtists?: ArtistContext["relatedArtists"]
  onSelectArtist: (artist: { id: string; name: string }) => void
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export default function RecommendedArtists({
  recommendations,
  relatedArtists,
  onSelectArtist,
}: Props) {
  const hasRelated = relatedArtists && relatedArtists.length > 0
  const hasRecs = recommendations.length > 0

  if (!hasRelated && !hasRecs) return null

  if (hasRelated) {
    return (
      <section className="space-y-4 border-t border-stone-200 pt-8">
        <div className="font-display text-2xl tracking-[0.12em] text-black/75">
          IF YOU LIKE THIS
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {relatedArtists!.map((artist) => (
            <button
              key={artist.name}
              type="button"
              onClick={() =>
                onSelectArtist({
                  id: toSlug(artist.name),
                  name: artist.name.toUpperCase(),
                })
              }
              className="group flex flex-col gap-1.5 rounded-sm border border-stone-200 bg-white/40 px-4 py-3 text-left transition-colors hover:border-[#d94f43]/30 hover:bg-white/70"
            >
              <span className="font-display text-base tracking-[0.12em] text-black/80 group-hover:text-[#d94f43]">
                {artist.name.toUpperCase()}
              </span>
              {artist.reason && (
                <span className="text-[11px] leading-snug text-black/45">
                  {artist.reason}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4 border-t border-stone-200 pt-8">
      <div className="font-display text-2xl tracking-[0.12em] text-black/75">
        RECOMMENDED FOR YOU
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {recommendations.map((rec) => (
          <button
            key={rec.id}
            type="button"
            onClick={() =>
              onSelectArtist({
                id: toSlug(rec.name),
                name: rec.name.toUpperCase(),
              })
            }
            className="group flex flex-col gap-2 rounded-sm border border-stone-200 bg-white/40 px-4 py-3 text-left transition-colors hover:border-[#d94f43]/30 hover:bg-white/70"
          >
            <span className="font-display text-base tracking-[0.12em] text-black/80 group-hover:text-[#d94f43]">
              {rec.name.toUpperCase()}
            </span>

            {rec.tags && rec.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {rec.tags.slice(0, 3).map((tag, i) => (
                  <span
                    key={tag}
                    className="text-[9px] font-semibold uppercase tracking-[0.15em] text-black/45"
                  >
                    {i > 0 && "·"} {tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
