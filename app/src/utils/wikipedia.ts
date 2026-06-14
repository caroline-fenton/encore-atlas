const API_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary"

export type WikipediaSummary = {
  extract: string
  thumbnailUrl: string | null
  pageUrl: string
}

function toTitleCase(artistName: string): string {
  return artistName.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function toTitlePath(title: string): string {
  return encodeURIComponent(title.replace(/\s+/g, "_"))
}

async function fetchSummary(
  title: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  const path = toTitlePath(title)
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: { "Api-User-Agent": "EncoreAtlas/1.0" },
    signal,
  })
  if (!res.ok) return null

  const data = await res.json()

  // Skip disambiguation pages or non-artist results
  if (data.type === "disambiguation") return null

  return data
}

/**
 * Fetches a Wikipedia summary for an artist, preferring the "(band)"
 * disambiguation page when one exists. For artists whose primary-topic
 * page is unrelated (e.g. "Destroyer" the warship vs. "Destroyer (band)"
 * the band), the bare name would silently return the wrong article. The
 * Wikipedia REST API follows redirects, so "X (band)" resolves to "X"
 * when no separate band article exists, making this a no-op for most
 * artists.
 */
export async function fetchWikipediaSummary(
  artistName: string,
  signal?: AbortSignal,
): Promise<WikipediaSummary | null> {
  const normalized = toTitleCase(artistName)

  const data =
    (await fetchSummary(`${normalized} (band)`, signal)) ??
    (await fetchSummary(normalized, signal))

  if (!data) return null

  return {
    extract: (data.extract as string) ?? "",
    thumbnailUrl: (data.thumbnail as { source?: string })?.source ?? null,
    pageUrl:
      (data.content_urls as { desktop?: { page?: string } })?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${toTitlePath(normalized)}`,
  }
}
