export function buildConcertSearchQuery(artistName: string): string {
  return `${artistName} live concert full set`
}

export function buildMusicVideoSearchQuery(artistName: string): string {
  return `${artistName} official music video`
}

export function buildInterviewSearchQuery(artistName: string): string {
  return `${artistName} interview`
}
