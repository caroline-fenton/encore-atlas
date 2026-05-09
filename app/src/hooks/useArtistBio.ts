import { useState, useEffect } from "react"
import { supabase } from "../services/supabase"

type ArtistBioData = {
  bio: string | null
  imageUrl: string | null
}

export function useArtistBio(artistName: string) {
  const [data, setData] = useState<ArtistBioData>({ bio: null, imageUrl: null })
  const [isLoading, setIsLoading] = useState(true)
  const [prevArtist, setPrevArtist] = useState(artistName)

  if (prevArtist !== artistName) {
    setPrevArtist(artistName)
    setData({ bio: null, imageUrl: null })
    setIsLoading(true)
  }

  useEffect(() => {
    let cancelled = false
    const normalized = artistName.trim().toLowerCase()
    const escaped = normalized.replace(/%/g, "\\%").replace(/_/g, "\\_")

    Promise.resolve(
      supabase
        .from("artists")
        .select("bio, wikipedia_thumbnail_url")
        .ilike("name", escaped)
        .maybeSingle(),
    )
      .then(({ data: artist }) => {
        if (!cancelled) {
          setData({
            bio: artist?.bio ?? null,
            imageUrl: artist?.wikipedia_thumbnail_url ?? null,
          })
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
