import { useMemo } from "react"
import type { Video } from "../../types/video"
import { parseYearFromTitle, yearToDecade } from "../../utils/parseYear"

const PALETTE = [
  "#d94f43", "#4db8e8", "#c2d44a", "#3580b0",
  "#f07cbf", "#5a9a6e", "#eba264", "#9256a8",
  "#6fd4a2", "#a8612e", "#62d4eb", "#b0456a",
]

type DecadeFilterProps = {
  videos: Video[]
  selected: string | null
  onSelect: (decade: string | null) => void
}

export default function DecadeFilter({ videos, selected, onSelect }: DecadeFilterProps) {
  const decades = useMemo(() => {
    const set = new Set<string>()
    for (const v of videos) {
      const year = parseYearFromTitle(v.title)
      if (year) set.add(yearToDecade(year))
    }
    return [...set].sort()
  }, [videos])

  if (decades.length < 2) return null

  // "All" pill uses the first color
  const allColor = PALETTE[0]

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={[
          "px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] border transition-colors",
          selected === null
            ? "text-white"
            : "border-stone-300 text-black/50 hover:text-black/80",
        ].join(" ")}
        style={
          selected === null
            ? { borderColor: allColor, backgroundColor: allColor }
            : undefined
        }
        onMouseEnter={(e) => {
          if (selected !== null) {
            e.currentTarget.style.borderColor = `${allColor}60`
          }
        }}
        onMouseLeave={(e) => {
          if (selected !== null) {
            e.currentTarget.style.borderColor = ""
          }
        }}
      >
        All
      </button>
      {decades.map((decade, i) => {
        const color = PALETTE[(i + 1) % PALETTE.length]
        const isActive = selected === decade
        return (
          <button
            key={decade}
            type="button"
            onClick={() => onSelect(selected === decade ? null : decade)}
            className={[
              "px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] border transition-colors",
              isActive
                ? "text-white"
                : "border-stone-300 text-black/50 hover:text-black/80",
            ].join(" ")}
            style={
              isActive
                ? { borderColor: color, backgroundColor: color }
                : undefined
            }
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = `${color}60`
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = ""
              }
            }}
          >
            {decade.slice(0, -1)}<span className="text-[7px]">s</span>
          </button>
        )
      })}
    </div>
  )
}
