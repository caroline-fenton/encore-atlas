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
