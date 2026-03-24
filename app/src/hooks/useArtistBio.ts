import { useState, useEffect } from "react"
import { fetchArtistBio, type ArtistBio } from "../services/wikipedia"

export function useArtistBio(artistName: string) {
  const [bio, setBio] = useState<ArtistBio | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setBio(null)
    setIsLoading(true)

    fetchArtistBio(artistName, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setBio(result)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [artistName])

  return { bio, isLoading }
}
