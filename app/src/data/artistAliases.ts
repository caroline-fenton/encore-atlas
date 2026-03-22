/**
 * Maps artist names to alternate names that should also be accepted
 * by the relevance filter. Keys must be lowercase.
 *
 * Example: searching "Freddie Mercury" will also accept videos
 * with "Queen" in the title, and vice versa.
 */
const artistAliases: Record<string, string[]> = {
  "freddie mercury": ["queen"],
  "queen": ["freddie mercury"],
  "beyonce": ["destinys child", "destiny's child"],
  "bob marley": ["bob marley and the wailers", "the wailers"],
  "fela kuti": ["fela kuti and africa 70", "africa 70"],
}

export function getAliases(artistName: string): string[] {
  return artistAliases[artistName.toLowerCase()] ?? []
}
