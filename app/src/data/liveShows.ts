import type { LiveShow } from "../types/liveShows"

// NOTE: These are placeholder images. Swap for your preferred assets later.
// Keep YouTube links as external only (no embed) per MVP scope.
export const liveShows: LiveShow[] = [
  {
    id: "smiths-featured-1",
    artistId: "the-smiths",
    title: "Live at The Apollo",
    venue: "The Apollo",
    city: "Manchester",
    year: 1986,
    duration: "1:42:15",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=2200&q=80",
    youtubeUrl: "https://www.youtube.com",
    isFeatured: true,
    isCompleteConcert: true,
  },
  {
    id: "smiths-more-1",
    artistId: "the-smiths",
    title: "Live at Brixton Academy",
    venue: "Brixton Academy",
    city: "London",
    year: 1985,
    duration: "58:32",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=80",
    youtubeUrl: "https://www.youtube.com",
  },
  {
    id: "smiths-more-2",
    artistId: "the-smiths",
    title: "Festival Performance",
    venue: "Glastonbury",
    city: "Somerset",
    year: 1984,
    duration: "45:18",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=1200&q=80",
    youtubeUrl: "https://www.youtube.com",
  },
  {
    id: "smiths-more-3",
    artistId: "the-smiths",
    title: "Intimate Club Show",
    venue: "The Hacienda",
    city: "Manchester",
    year: 1983,
    duration: "1:12:45",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80",
    youtubeUrl: "https://www.youtube.com",
  },
  {
    id: "smiths-more-4",
    artistId: "the-smiths",
    title: "European Tour Finale",
    venue: "Paradiso",
    city: "Amsterdam",
    year: 1986,
    duration: "1:28:00",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80",
    youtubeUrl: "https://www.youtube.com",
  },
]

export function getLiveShowsForArtist(artistId: string) {
  const featured = liveShows.find((s) => s.artistId === artistId && s.isFeatured)
  const more = liveShows.filter((s) => s.artistId === artistId && !s.isFeatured)
  return { featured, more }
}
