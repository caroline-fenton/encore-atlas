import { useState, useMemo, useEffect } from "react"
import type { Video } from "../types/video"
import { parseYearFromTitle, yearToDecade } from "../utils/parseYear"

export function useDecadeFilter(videos: Video[], artistName: string) {
  const [selectedDecade, setSelectedDecade] = useState<string | null>(null)

  // Reset filter when artist changes
  useEffect(() => {
    setSelectedDecade(null)
  }, [artistName])

  const filtered = useMemo(() => {
    if (!selectedDecade) return videos
    return videos.filter((v) => {
      const year = parseYearFromTitle(v.title)
      return year != null && yearToDecade(year) === selectedDecade
    })
  }, [videos, selectedDecade])

  return { filtered, selectedDecade, setSelectedDecade }
}
