export type SearchFilters = {
  year?: string
  album?: string
}

function appendFilters(base: string, filters?: SearchFilters): string {
  if (!filters) return base
  const parts = [base]
  if (filters.album?.trim()) parts.push(filters.album.trim())
  if (filters.year?.trim()) parts.push(filters.year.trim())
  return parts.join(" ")
}

export function buildConcertSearchQuery(artistName: string, filters?: SearchFilters): string {
  return appendFilters(`${artistName} live concert full set`, filters)
}

export function buildMusicVideoSearchQuery(artistName: string, filters?: SearchFilters): string {
  return appendFilters(`${artistName} official music video`, filters)
}

export function buildInterviewSearchQuery(artistName: string, filters?: SearchFilters): string {
  return appendFilters(`${artistName} interview`, filters)
}

/** Returns true if the year string is a valid 4-digit year. */
export function isNumericYear(year: string): boolean {
  return /^\d{4}$/.test(year.trim())
}

/**
 * Widen a specific year to a decade-era phrase for YouTube search.
 * e.g. 1993 → "early 90s", 1998 → "late 90s", 2005 → "mid 2000s"
 * Returns null for non-numeric input so callers can skip the retry.
 */
export function widenYearFilter(year: string): string | null {
  const num = parseInt(year, 10)
  if (isNaN(num)) return null

  const decadeStart = Math.floor(num / 10) * 10
  const decadeLabel = decadeStart < 2000 ? `${decadeStart - 1900}s` : `${decadeStart}s`
  const pos = num % 10

  if (pos <= 3) return `early ${decadeLabel}`
  if (pos <= 6) return `mid ${decadeLabel}`
  return `late ${decadeLabel}`
}
