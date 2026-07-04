import { supabase } from "./supabase"
import { getCached, setCache } from "./cache"

export type UpcomingShow = {
  id: string
  /** YYYY-MM-DD in the venue's local time */
  date: string
  venue: string
  city: string | null
  url: string | null
}

export type UpcomingShowsData = {
  shows: UpcomingShow[]
  allShowsUrl: string | null
}

const EMPTY: UpcomingShowsData = { shows: [], allShowsUrl: null }

// Tour dates change slowly; half a day of staleness is fine and keeps
// Ticketmaster traffic to roughly one edge-function call per artist per day
// per browser.
const SHOWS_CACHE_TTL_MS = 12 * 60 * 60 * 1000

function isValidShow(value: unknown): value is UpcomingShow {
  const show = value as UpcomingShow | null
  return Boolean(
    show
    && typeof show.id === "string"
    && typeof show.venue === "string"
    && typeof show.date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(show.date),
  )
}

/**
 * Fetches upcoming Ticketmaster shows for an artist via the upcoming-shows
 * edge function, with a localStorage cache. Failures resolve to an empty
 * list — the UI hides the section rather than showing an error.
 */
export async function fetchUpcomingShows(
  artistName: string,
): Promise<UpcomingShowsData> {
  const normalized = artistName.trim().toLowerCase()
  if (!normalized) return EMPTY

  const cacheKey = `upcoming_shows_${normalized}`
  const cached = getCached<UpcomingShowsData>(cacheKey)
  if (cached) return cached

  const { data, error } = await supabase.functions.invoke("upcoming-shows", {
    body: { artist_name: artistName },
  })

  // Errors are not cached — a transient failure shouldn't hide a tour for
  // the next 12 hours.
  if (error) return EMPTY

  const result: UpcomingShowsData = {
    shows: Array.isArray(data?.shows) ? data.shows.filter(isValidShow) : [],
    allShowsUrl:
      typeof data?.attraction_url === "string" ? data.attraction_url : null,
  }
  setCache(cacheKey, result, SHOWS_CACHE_TTL_MS)
  return result
}
