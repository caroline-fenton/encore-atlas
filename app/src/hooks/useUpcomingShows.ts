import { useState, useEffect } from "react"
import {
  fetchUpcomingShows,
  type UpcomingShowsData,
} from "../services/upcomingShows"

const EMPTY: UpcomingShowsData = { shows: [], allShowsUrl: null }

export function useUpcomingShows(artistName: string) {
  const [data, setData] = useState<UpcomingShowsData>(EMPTY)
  const [isLoading, setIsLoading] = useState(true)
  const [prevArtist, setPrevArtist] = useState(artistName)

  if (prevArtist !== artistName) {
    setPrevArtist(artistName)
    setData(EMPTY)
    setIsLoading(true)
  }

  useEffect(() => {
    let cancelled = false

    fetchUpcomingShows(artistName)
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [artistName])

  return { ...data, isLoading }
}
