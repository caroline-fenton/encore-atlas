import { normalizeArtistName } from "../../../src/utils/artistNameFilters.ts"

/**
 * Ticketmaster Discovery API helpers for the upcoming-shows edge function.
 *
 * Resolution is two-step: an attraction (artist) lookup by keyword, then an
 * event search by attraction id. Keyword event search alone is too fuzzy —
 * "Chicago" the band would match every event in Chicago — so events are only
 * fetched for an attraction whose name actually matches the requested artist.
 */

export type TicketmasterAttraction = {
  id?: string
  name?: string
  url?: string
}

export type TicketmasterEvent = {
  id?: string
  name?: string
  url?: string
  dates?: {
    start?: { localDate?: string }
    status?: { code?: string }
  }
  _embedded?: {
    venues?: Array<{
      name?: string
      city?: { name?: string }
      state?: { stateCode?: string }
      country?: { countryCode?: string }
    }>
  }
}

export type UpcomingShow = {
  id: string
  date: string
  venue: string
  city: string | null
  url: string | null
}

// Canceled shows aren't happening; postponed shows still carry their
// original (now wrong) date because the new one is TBD. Rescheduled events
// are kept — Ticketmaster updates dates.start to the new date once it's set.
const EXCLUDED_STATUS_CODES = new Set(["canceled", "cancelled", "postponed"])

/**
 * Returns the first attraction whose name matches the query after
 * normalization — or null when nothing matches. Candidates arrive sorted by
 * Ticketmaster relevance, so the first hit is the best one. Punctuation-only
 * names ("!!!") normalize to the empty string, which would match everything —
 * compare those raw and case-insensitively instead.
 */
export function pickAttraction(
  queryName: string,
  candidates: TicketmasterAttraction[],
): TicketmasterAttraction | null {
  const target = normalizeArtistName(queryName)
  const rawTarget = queryName.trim().toLowerCase()
  if (!rawTarget) return null
  const matches = target
    ? (n: string) => normalizeArtistName(n) === target
    : (n: string) => n.trim().toLowerCase() === rawTarget

  for (const candidate of candidates) {
    if (!candidate.id || !candidate.name) continue
    if (matches(candidate.name)) return candidate
  }

  return null
}

/**
 * Maps raw Discovery API events to display rows, dropping entries without a
 * date or venue. Multi-ticket listings for the same night (VIP packages,
 * platinum seats) show up as separate events — one row per venue-night is
 * enough, and the first listing wins.
 */
export function normalizeShows(events: TicketmasterEvent[]): UpcomingShow[] {
  const shows: UpcomingShow[] = []
  const seen = new Set<string>()

  for (const event of events) {
    const date = event.dates?.start?.localDate
    const venue = event._embedded?.venues?.[0]
    const venueName = venue?.name?.trim()
    if (!event.id || !date || !venueName) continue

    const statusCode = event.dates?.status?.code?.trim().toLowerCase()
    if (statusCode && EXCLUDED_STATUS_CODES.has(statusCode)) continue

    const key = `${date}:${venueName.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)

    const cityName = venue?.city?.name?.trim()
    const region = venue?.state?.stateCode ?? venue?.country?.countryCode
    shows.push({
      id: event.id,
      date,
      venue: venueName,
      city: cityName ? (region ? `${cityName}, ${region}` : cityName) : null,
      url: event.url ?? null,
    })
  }

  // The API is asked for date-ascending order, but dedupe and defensive
  // filtering shouldn't rely on it. localDate is YYYY-MM-DD, so string
  // comparison sorts chronologically.
  return shows.sort((a, b) => a.date.localeCompare(b.date))
}
