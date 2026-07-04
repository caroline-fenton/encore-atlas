import { normalizeArtistName } from "../../../src/utils/artistNameFilters.ts"

/**
 * MusicBrainz existence checks for LLM-suggested artist names.
 *
 * Every related artist Claude suggests must resolve to a real MusicBrainz
 * artist before we persist it; matches also swap in MusicBrainz's canonical
 * name (so "radio head" becomes "Radiohead"). MusicBrainz limits anonymous
 * clients to ~1 request/second on average and blocks IPs that exceed it —
 * lookups are paced accordingly, which is fine because a build runs once per
 * artist and the result is cached.
 */

const MUSICBRAINZ_SEARCH_URL = "https://musicbrainz.org/ws/2/artist/"
// MusicBrainz requires a descriptive User-Agent with contact info.
const USER_AGENT = "EncoreAtlas/1.0 (fenton.caroline@gmail.com)"
const REQUEST_GAP_MS = 1000
const REQUEST_TIMEOUT_MS = 5000
const MAX_LOOKUPS = 12

export type MusicBrainzArtist = {
  name?: string
  "sort-name"?: string
  aliases?: Array<{ name?: string }>
}

type SearchOutcome =
  | { ok: true; canonicalName: string | null }
  | { ok: false }

/**
 * Returns the MusicBrainz canonical name for the first candidate whose name,
 * sort-name, or any alias matches the query after normalization — or null
 * when nothing matches. Candidates arrive sorted by MusicBrainz match score,
 * so the first hit is the best one.
 */
export function pickCanonicalName(
  queryName: string,
  candidates: MusicBrainzArtist[],
): string | null {
  const target = normalizeArtistName(queryName)
  if (!target) return null

  for (const candidate of candidates) {
    if (!candidate.name) continue
    const namesToCheck = [
      candidate.name,
      candidate["sort-name"] ?? "",
      ...(candidate.aliases ?? []).map((a) => a.name ?? ""),
    ]
    if (namesToCheck.some((n) => n && normalizeArtistName(n) === target)) {
      return candidate.name
    }
  }

  return null
}

// Escape Lucene query syntax so artist names can't break the search query.
export function escapeLucene(value: string): string {
  return value.replace(/(&&|\|\||[+\-!(){}[\]^"~*?:\\/])/g, "\\$1")
}

async function searchArtist(
  name: string,
  fetchImpl: typeof fetch,
): Promise<SearchOutcome> {
  const params = new URLSearchParams({
    query: `artist:"${escapeLucene(name)}"`,
    limit: "5",
    fmt: "json",
  })

  try {
    const res = await fetchImpl(`${MUSICBRAINZ_SEARCH_URL}?${params}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!res.ok) {
      console.error(`MusicBrainz search failed (${res.status}) for "${name}"`)
      return { ok: false }
    }

    const data = await res.json()
    const artists: MusicBrainzArtist[] = Array.isArray(data.artists)
      ? data.artists
      : []
    return { ok: true, canonicalName: pickCanonicalName(name, artists) }
  } catch (err) {
    console.error(`MusicBrainz search errored for "${name}":`, err)
    return { ok: false }
  }
}

/**
 * Verifies artist names against MusicBrainz, sequentially and rate-limited.
 *
 * Result map values:
 *   - canonical MusicBrainz name → verified (may differ from the input)
 *   - the input name itself      → lookup failed; fail open and keep it
 *   - null                       → MusicBrainz has no such artist; drop it
 */
export async function verifyArtistNames(
  names: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()
  const toCheck = names.slice(0, MAX_LOOKUPS)

  // Names beyond the lookup cap pass through unverified rather than being
  // dropped for a reason unrelated to their validity.
  for (const name of names.slice(MAX_LOOKUPS)) {
    results.set(name, name)
  }

  for (let i = 0; i < toCheck.length; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS))
    }
    const name = toCheck[i]
    const outcome = await searchArtist(name, fetchImpl)
    results.set(name, outcome.ok ? outcome.canonicalName : name)
  }

  return results
}
