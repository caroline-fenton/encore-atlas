export type SuggestedArtist = {
  id: string
  name: string
}

const artistPool: SuggestedArtist[] = [
  { id: "the-smiths", name: "THE SMITHS" },
  { id: "lady-gaga", name: "LADY GAGA" },
  { id: "tyler-the-creator", name: "TYLER THE CREATOR" },
  { id: "toots-and-the-maytals", name: "TOOTS AND THE MAYTALS" },
  { id: "radiohead", name: "RADIOHEAD" },
  { id: "beyonce", name: "BEYONCE" },
  { id: "nirvana", name: "NIRVANA" },
  { id: "kendrick-lamar", name: "KENDRICK LAMAR" },
  { id: "bob-marley", name: "BOB MARLEY" },
  { id: "lcd-soundsystem", name: "LCD SOUNDSYSTEM" },
  { id: "sza", name: "SZA" },
  { id: "the-cure", name: "THE CURE" },
  { id: "daft-punk", name: "DAFT PUNK" },
  { id: "erykah-badu", name: "ERYKAH BADU" },
  { id: "arctic-monkeys", name: "ARCTIC MONKEYS" },
  { id: "fela-kuti", name: "FELA KUTI" },
]

/**
 * Deterministic seeded shuffle — same week = same order for all users.
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const shuffled = [...arr]
  let s = seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Simple LCG-style PRNG
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = ((s >>> 0) % (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Returns 4 suggested artists, rotating weekly.
 * All users see the same 4 in any given week.
 */
export function getSuggestedArtists(count = 4): SuggestedArtist[] {
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  const shuffled = seededShuffle(artistPool, weekNumber)
  return shuffled.slice(0, count)
}

/**
 * Returns the full pool (useful for matching typed input against known artists).
 */
export function getAllArtists(): SuggestedArtist[] {
  return artistPool
}
