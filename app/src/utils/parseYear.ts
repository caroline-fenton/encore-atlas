/**
 * Extract a plausible performance year from a video title.
 * Matches 4-digit years between 1950 and 2039.
 * Returns null if no year is found.
 */
export function parseYearFromTitle(title: string): number | null {
  const years: number[] = []

  // Match 4-digit years (e.g. "1977", "2025")
  const fourDigit = title.match(/\b(19[5-9]\d|20[0-3]\d)\b/g)
  if (fourDigit) {
    years.push(...fourDigit.map(Number))
  }

  // Only try 2-digit year patterns when no 4-digit year was found.
  // This avoids misinterpreting YYYY-MM-DD dates (e.g. "2001-02-03"
  // where "03" would be incorrectly parsed as year 2003).
  if (years.length === 0) {
    const twoDigit = title.match(/[\/.\-]\d{1,2}[\/.\-](\d{2})\b/g)
    if (twoDigit) {
      for (const match of twoDigit) {
        const yy = parseInt(match.slice(-2), 10)
        const full = yy >= 50 ? 1900 + yy : 2000 + yy
        years.push(full)
      }
    }
  }

  if (years.length === 0) return null

  const currentYear = new Date().getFullYear()
  const valid = years.filter((y) => y <= currentYear)
  return valid.length > 0 ? Math.max(...valid) : null
}

export function yearToDecade(year: number): string {
  const decadeStart = Math.floor(year / 10) * 10
  return `${decadeStart}s`
}
