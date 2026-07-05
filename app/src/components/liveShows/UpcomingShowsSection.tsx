import { ExternalLink } from "lucide-react"
import type { UpcomingShow } from "../../services/upcomingShows"

const MAX_VISIBLE_SHOWS = 4
// Same trio the merch store links cycle through, so the sidebar shares one
// accent rhythm.
const STUB_ACCENTS = ["#d94f43", "#4db8e8", "#5a9a6e"]
const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
]

// Parsed from the YYYY-MM-DD string directly — Date would shift the venue's
// local date across timezones.
function showDateParts(
  date: string,
): { month: string; day: string; year: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  const month = MONTHS[Number(match[2]) - 1]
  if (!month) return null
  return { month, day: match[3], year: Number(match[1]) }
}

function ShowCard({
  show,
  currentYear,
  accent,
}: {
  show: UpcomingShow
  currentYear: number
  accent: string
}) {
  const dateParts = showDateParts(show.date)

  return (
    <a
      href={show.url ?? undefined}
      target="_blank"
      rel="noreferrer"
      style={{ "--stub-accent": accent } as React.CSSProperties}
      className="group flex items-center gap-3 border border-stone-200 bg-white/60 p-3 transition hover:border-(--stub-accent)/30 hover:shadow-sm"
    >
      {dateParts && (
        <div className="shrink-0 border-r border-dashed border-black/25 pr-3 text-center font-mono">
          <div
            className="text-[10px] font-semibold tracking-[0.15em]"
            style={{ color: accent }}
          >
            {dateParts.month}
          </div>
          <div className="text-lg leading-tight text-black/80">
            {dateParts.day}
          </div>
          {dateParts.year !== currentYear && (
            <div className="text-[9px] text-black/40">{dateParts.year}</div>
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-display text-xs tracking-[0.08em] text-black/80 group-hover:text-(--stub-accent) leading-snug">
          {show.venue}
        </div>
        {show.city && (
          <div className="font-typewriter text-[10px] text-black/50">
            {show.city}
          </div>
        )}
      </div>
      <ExternalLink className="h-2.5 w-2.5 shrink-0 text-black/40" />
    </a>
  )
}

type Props = {
  shows: UpcomingShow[]
  allShowsUrl: string | null
  isLoading: boolean
  className?: string
}

/**
 * Ticketmaster tour dates for the artist page sidebar. Renders nothing while
 * loading or when the artist has no upcoming shows — most classic-era artists
 * won't, and an empty box would read as an epitaph. Data comes from the
 * layout's single useUpcomingShows call: the desktop and mobile copies are
 * both mounted (only CSS hides one), so fetching here would double the
 * edge-function traffic.
 */
export default function UpcomingShowsSection({
  shows,
  allShowsUrl,
  isLoading,
  className = "",
}: Props) {
  if (isLoading || shows.length === 0) return null

  const currentYear = new Date().getFullYear()

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <div className="font-display text-xl tracking-[0.1em] text-black/80 uppercase">
          Upcoming Shows
        </div>
        <div className="font-mono text-[10px] text-black/40">
          via Ticketmaster
        </div>
      </div>

      <div className="space-y-2">
        {shows.slice(0, MAX_VISIBLE_SHOWS).map((show, i) => (
          <ShowCard
            key={show.id}
            show={show}
            currentYear={currentYear}
            accent={STUB_ACCENTS[i % STUB_ACCENTS.length]}
          />
        ))}
      </div>

      {allShowsUrl && (
        <a
          href={allShowsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[11px] text-black/40 transition hover:text-[#d94f43]"
        >
          All tour dates
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </div>
  )
}
