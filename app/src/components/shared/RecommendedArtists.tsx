import type { Recommendation } from "../../services/recommendations"

type Props = {
  recommendations: Recommendation[]
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
  onSelectArtist,
}: Props) {
  if (recommendations.length === 0) return null

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
            className="group flex flex-col gap-2 rounded-sm border border-stone-200 bg-white/40 px-4 py-3 text-left transition-colors hover:border-[#7a2d2b]/30 hover:bg-white/70"
          >
            <span className="font-display text-base tracking-[0.12em] text-black/80 group-hover:text-[#7a2d2b]">
              {rec.name.toUpperCase()}
            </span>

            {rec.tags && rec.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {rec.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-black/10 bg-white/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-black/45"
                  >
                    {tag}
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
