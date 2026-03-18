export type CuratedArtist = {
  id: string
  name: string
  concerts: string[] // YouTube video IDs (first = featured)
  interviews: string[] // YouTube video IDs
}

// TODO: Replace placeholder IDs with real YouTube video IDs
// Each artist needs 5 concert IDs and 4 interview IDs
export const curatedArtists: CuratedArtist[] = [
  {
    id: "the-smiths",
    name: "THE SMITHS",
    concerts: [
      "REPLACE_WITH_VIDEO_ID", // featured
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
    ],
    interviews: [
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
    ],
  },
  {
    id: "joy-division",
    name: "JOY DIVISION",
    concerts: [
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
    ],
    interviews: [
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
    ],
  },
  {
    id: "talking-heads",
    name: "TALKING HEADS",
    concerts: [
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
    ],
    interviews: [
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
    ],
  },
  {
    id: "pixies",
    name: "PIXIES",
    concerts: [
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
    ],
    interviews: [
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
      "REPLACE_WITH_VIDEO_ID",
    ],
  },
]

export function getCuratedArtist(artistId: string): CuratedArtist | undefined {
  return curatedArtists.find((a) => a.id === artistId)
}

export function isCuratedArtist(artistId: string): boolean {
  return curatedArtists.some((a) => a.id === artistId)
}

export function getAllCuratedArtists(): CuratedArtist[] {
  return curatedArtists
}
