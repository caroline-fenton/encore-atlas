export function buildConcertSearchQuery(artistName: string): string {
  return `"${artistName}" live concert live performance full set`
}

export function buildInterviewSearchQuery(artistName: string): string {
  return `"${artistName}" interview`
}
