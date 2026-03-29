import { useState, useEffect } from "react"
import { fetchArtistBio, type ArtistBio } from "../services/wikipedia"

export function useArtistBio(artistName: string) {
  const [bio, setBio] = useState<ArtistBio | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [prevArtist, setPrevArtist] = useState(artistName)

  // Reset state synchronously during render when artist changes
  // (React supports calling setState during render for this pattern)
  if (prevArtist !== artistName) {
    setPrevArtist(artistName)
    setBio(null)
    setIsLoading(true)
  }

  useEffect(() => {
    const controller = new AbortController()

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
