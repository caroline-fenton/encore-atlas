import { getCached, setCache } from "./cache"
import { fetchWikipediaSummary, type WikipediaSummary } from "../utils/wikipedia"

export type ArtistBio = WikipediaSummary

export async function fetchArtistBio(
  artistName: string,
  signal?: AbortSignal,
): Promise<ArtistBio | null> {
  const cacheKey = `wiki_${artistName.toLowerCase()}`
  const cached = getCached<ArtistBio | "not_found">(cacheKey)
  if (cached === "not_found") return null
  if (cached) return cached

  try {
    const bio = await fetchWikipediaSummary(artistName, signal)
    setCache(cacheKey, bio ?? "not_found")
    return bio
  } catch {
    return null
  }
}
