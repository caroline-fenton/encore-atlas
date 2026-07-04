/**
 * Deterministic filters for LLM-suggested related-artist names.
 *
 * Shared by the build-artist-page edge function (fresh builds) and the
 * client-side normalizer (cached rows written before server-side validation
 * existed). These catch the failure modes we can detect without a network
 * call: mixed-script mashups ("راديو head"), the subject artist appearing in
 * its own related list, and duplicates. Existence checks against MusicBrainz
 * happen server-side in supabase/functions/_shared/musicbrainz.ts.
 */

export type RelatedArtistName = { name: string; reason: string }

// Script groups used for the mixed-script check. Han/Hiragana/Katakana/Hangul
// are one group because real CJK artist names routinely combine them
// (e.g. 宇多田ヒカル). Digits, punctuation, and whitespace are script-neutral.
const SCRIPT_GROUPS: Array<RegExp> = [
  /\p{Script=Latin}/u,
  /\p{Script=Arabic}/u,
  /\p{Script=Cyrillic}/u,
  /\p{Script=Greek}/u,
  /\p{Script=Hebrew}/u,
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u,
  /\p{Script=Thai}/u,
  /\p{Script=Devanagari}/u,
]

/**
 * True when a name contains letters from more than one script group —
 * "راديو head" (Arabic + Latin) is mixed; "Sigur Rós" and 東京事変 are not.
 */
export function hasMixedScript(name: string): boolean {
  let groups = 0
  for (const pattern of SCRIPT_GROUPS) {
    if (pattern.test(name)) groups++
    if (groups > 1) return true
  }
  return false
}

/**
 * Canonical form for name comparison: lowercase, diacritics stripped,
 * leading "the " removed, everything but letters/digits dropped.
 * "The Beach Boys" / "beach-boys" / "Béach Bóys" all collapse together.
 */
export function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/^the\s+/, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
}

export function isSameArtistName(a: string, b: string): boolean {
  const normA = normalizeArtistName(a)
  const normB = normalizeArtistName(b)
  return normA !== "" && normA === normB
}

/**
 * Drops related-artist entries that are empty, mix scripts, duplicate an
 * earlier entry, or name the subject artist itself. Pass an empty
 * subjectName to skip the self-reference check.
 */
export function filterRelatedArtists(
  subjectName: string,
  related: RelatedArtistName[],
): RelatedArtistName[] {
  const seen = new Set<string>()
  const result: RelatedArtistName[] = []

  for (const entry of related) {
    const name = entry.name.trim()
    if (!name) continue
    if (hasMixedScript(name)) continue
    if (subjectName && isSameArtistName(name, subjectName)) continue

    const key = normalizeArtistName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)

    result.push({ name, reason: entry.reason })
  }

  return result
}
