import { getCached, setCache } from "./cache"

const API_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary"

export type ArtistBio = {
  extract: string
  thumbnailUrl?: string
  pageUrl: string
}

export async function fetchArtistBio(
  artistName: string,
  signal?: AbortSignal,
): Promise<ArtistBio | null> {
  const cacheKey = `wiki_${artistName.toLowerCase()}`
  const cached = getCached<ArtistBio | "not_found">(cacheKey)
  if (cached === "not_found") return null
  if (cached) return cached

  try {
    // Wikipedia titles are case-sensitive on the first character;
    // convert "RADIOHEAD" → "Radiohead", "THE SMITHS" → "The Smiths"
    const normalized = artistName
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
    const title = encodeURIComponent(normalized.replace(/\s+/g, "_"))
    const res = await fetch(`${API_BASE}/${title}`, {
      headers: { "Api-User-Agent": "EncoreAtlas/1.0" },
      signal,
    })

    if (!res.ok) {
      if (res.status === 404) {
        setCache(cacheKey, "not_found")
        return null
      }
      return null
    }

    const data = await res.json()

    // Skip disambiguation pages or non-artist results
    if (data.type === "disambiguation") {
      setCache(cacheKey, "not_found")
      return null
    }

    const bio: ArtistBio = {
      extract: data.extract ?? "",
      thumbnailUrl: data.thumbnail?.source,
      pageUrl: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${title}`,
    }

    setCache(cacheKey, bio)
    return bio
  } catch {
    return null
  }
}
