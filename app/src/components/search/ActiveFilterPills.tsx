import { X } from "lucide-react"
import type { SearchFilters } from "../../services/searchQueries"

type Props = {
  filters: SearchFilters
  onClearFilter: (key: "year" | "album") => void
}

export default function ActiveFilterPills({ filters, onClearFilter }: Props) {
  const pills: { key: "year" | "album"; label: string; value: string }[] = []

  if (filters.year?.trim()) {
    pills.push({ key: "year", label: "Year", value: filters.year.trim() })
  }
  if (filters.album?.trim()) {
    pills.push({ key: "album", label: "Album", value: filters.album.trim() })
  }

  if (pills.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      {pills.map((pill) => (
        <span
          key={pill.key}
          className="inline-flex items-center gap-1.5 rounded-sm border border-stone-300 px-2 py-0.5 font-typewriter text-[10px] uppercase tracking-[0.2em] text-black/55"
        >
          {pill.label}: {pill.value}
          <button
            type="button"
            onClick={() => onClearFilter(pill.key)}
            className="text-black/30 hover:text-black/60"
            aria-label={`Clear ${pill.label} filter`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
    </div>
  )
}
