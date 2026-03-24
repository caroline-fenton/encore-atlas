/**
 * Extract a plausible performance year from a video title.
 * Matches 4-digit years between 1950 and 2039.
 * Returns null if no year is found.
 */
export function parseYearFromTitle(title: string): number | null {
  const matches = title.match(/\b(19[5-9]\d|20[0-3]\d)\b/g)
  if (!matches) return null

  // If multiple years, prefer the one most likely to be a performance year.
  // Typically the latest year <= current year is the performance date.
  const currentYear = new Date().getFullYear()
  const years = matches.map(Number).filter((y) => y <= currentYear)
  return years.length > 0 ? Math.max(...years) : null
}

export function yearToDecade(year: number): string {
  const decadeStart = Math.floor(year / 10) * 10
  return `${decadeStart}s`
}
