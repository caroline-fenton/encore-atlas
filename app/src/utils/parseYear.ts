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

  // Match 2-digit years after /, -, or . in date patterns (e.g. "6/11/93", "5-8-77", "9.6.96")
  // Exclude : to avoid matching timestamps like "1:23:24"
  const twoDigit = title.match(/[\/.\-]\d{1,2}[\/.\-](\d{2})\b/g)
  if (twoDigit) {
    for (const match of twoDigit) {
      const yy = parseInt(match.slice(-2), 10)
      const full = yy >= 50 ? 1900 + yy : 2000 + yy
      years.push(full)
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
