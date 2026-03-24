import { useMemo } from "react"
import type { Video } from "../../types/video"
import { parseYearFromTitle, yearToDecade } from "../../utils/parseYear"

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

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={[
          "px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] border transition-colors",
          selected === null
            ? "border-[#7a2d2b] bg-[#7a2d2b] text-white"
            : "border-stone-300 text-black/50 hover:border-[#7a2d2b]/30 hover:text-[#7a2d2b]",
        ].join(" ")}
      >
        All
      </button>
      {decades.map((decade) => (
        <button
          key={decade}
          type="button"
          onClick={() => onSelect(selected === decade ? null : decade)}
          className={[
            "px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] border transition-colors",
            selected === decade
              ? "border-[#7a2d2b] bg-[#7a2d2b] text-white"
              : "border-stone-300 text-black/50 hover:border-[#7a2d2b]/30 hover:text-[#7a2d2b]",
          ].join(" ")}
        >
          {decade.slice(0, -1)}<span className="text-[7px]">s</span>
        </button>
      ))}
    </div>
  )
}
