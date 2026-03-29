import { useState, useMemo } from "react"
import type { Video } from "../types/video"
import { parseYearFromTitle, yearToDecade } from "../utils/parseYear"

export function useDecadeFilter(videos: Video[], artistName: string) {
  const [selectedDecade, setSelectedDecade] = useState<string | null>(null)
  const [prevArtist, setPrevArtist] = useState(artistName)

  // Reset filter synchronously during render when artist changes
  if (prevArtist !== artistName) {
    setPrevArtist(artistName)
    setSelectedDecade(null)
  }

  const filtered = useMemo(() => {
    if (!selectedDecade) return videos
    return videos.filter((v) => {
      const year = parseYearFromTitle(v.title)
      return year != null && yearToDecade(year) === selectedDecade
    })
  }, [videos, selectedDecade])

  return { filtered, selectedDecade, setSelectedDecade }
}
