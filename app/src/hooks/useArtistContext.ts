import { useState, useEffect } from "react"
import { supabase } from "../services/supabase"
import type { ArtistContext } from "../services/artistPage"

export function useArtistContext(artistName: string) {
  const [context, setContext] = useState<ArtistContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [prevArtist, setPrevArtist] = useState(artistName)

  if (prevArtist !== artistName) {
    setPrevArtist(artistName)
    setContext(null)
    setIsLoading(true)
  }

  useEffect(() => {
    if (!artistName) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    const normalized = artistName.trim().toLowerCase()
    const escaped = normalized.replace(/%/g, "\\%").replace(/_/g, "\\_")

    supabase
      .from("artists")
      .select("artist_context")
      .ilike("name", escaped)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (!cancelled) {
            setContext((data?.artist_context as ArtistContext) ?? null)
            setIsLoading(false)
          }
        },
        () => {
          if (!cancelled) setIsLoading(false)
        },
      )

    return () => {
      cancelled = true
    }
  }, [artistName])

  return { context, isLoading }
}
