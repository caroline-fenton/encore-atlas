import assert from "node:assert/strict"
import test from "node:test"
import {
  normalizeShows,
  pickAttraction,
  type TicketmasterAttraction,
  type TicketmasterEvent,
} from "./ticketmaster.ts"

test("pickAttraction matches exact names", () => {
  const candidates: TicketmasterAttraction[] = [
    { id: "K1", name: "Radiohead", url: "https://tm.example/radiohead" },
  ]
  assert.equal(pickAttraction("Radiohead", candidates)?.id, "K1")
})

test("pickAttraction canonicalizes spacing, casing, and leading 'the'", () => {
  const candidates: TicketmasterAttraction[] = [
    { id: "K1", name: "The Beach Boys" },
  ]
  assert.equal(pickAttraction("beach-boys", candidates)?.id, "K1")
})

test("pickAttraction skips near-miss candidates ranked first", () => {
  const candidates: TicketmasterAttraction[] = [
    { id: "K1", name: "Genesis Owusu" },
    { id: "K2", name: "Genesis" },
  ]
  assert.equal(pickAttraction("Genesis", candidates)?.id, "K2")
})

test("pickAttraction matches punctuation-only names raw", () => {
  const candidates: TicketmasterAttraction[] = [
    { id: "K1", name: "??" },
    { id: "K2", name: "!!!" },
  ]
  assert.equal(pickAttraction("!!!", candidates)?.id, "K2")
})

test("pickAttraction returns null when nothing matches", () => {
  const candidates: TicketmasterAttraction[] = [
    { id: "K1", name: "Radiohead Tribute Band" },
  ]
  assert.equal(pickAttraction("Radiohead", candidates), null)
})

test("pickAttraction ignores candidates missing an id or name", () => {
  const candidates: TicketmasterAttraction[] = [
    { name: "Radiohead" },
    { id: "K2" },
  ]
  assert.equal(pickAttraction("Radiohead", candidates), null)
})

function event(overrides: Partial<{
  id: string
  date: string
  venue: string
  city: string
  state: string
  country: string
  url: string
  status: string
}>): TicketmasterEvent {
  return {
    id: overrides.id ?? "E1",
    url: overrides.url,
    dates: {
      start: { localDate: overrides.date ?? "2026-09-14" },
      status: overrides.status ? { code: overrides.status } : undefined,
    },
    _embedded: {
      venues: [{
        name: overrides.venue ?? "Royal Albert Hall",
        city: overrides.city ? { name: overrides.city } : undefined,
        state: overrides.state ? { stateCode: overrides.state } : undefined,
        country: overrides.country ? { countryCode: overrides.country } : undefined,
      }],
    },
  }
}

test("normalizeShows maps event fields", () => {
  const shows = normalizeShows([
    event({ city: "London", country: "GB", url: "https://tm.example/e1" }),
  ])
  assert.deepEqual(shows, [{
    id: "E1",
    date: "2026-09-14",
    venue: "Royal Albert Hall",
    city: "London, GB",
    url: "https://tm.example/e1",
  }])
})

test("normalizeShows prefers state code over country code", () => {
  const shows = normalizeShows([
    event({ city: "Austin", state: "TX", country: "US" }),
  ])
  assert.equal(shows[0].city, "Austin, TX")
})

test("normalizeShows handles missing city and url", () => {
  const shows = normalizeShows([event({})])
  assert.equal(shows[0].city, null)
  assert.equal(shows[0].url, null)
})

test("normalizeShows drops events without a date or venue", () => {
  const noDate: TicketmasterEvent = {
    id: "E1",
    _embedded: { venues: [{ name: "The Fillmore" }] },
  }
  const noVenue: TicketmasterEvent = {
    id: "E2",
    dates: { start: { localDate: "2026-09-14" } },
  }
  assert.deepEqual(normalizeShows([noDate, noVenue]), [])
})

test("normalizeShows keeps one row per venue-night", () => {
  const shows = normalizeShows([
    event({ id: "E1" }),
    event({ id: "E2", url: "https://tm.example/vip" }),
    event({ id: "E3", date: "2026-09-15" }),
  ])
  assert.deepEqual(shows.map((s) => s.id), ["E1", "E3"])
})

test("normalizeShows drops canceled and postponed events", () => {
  const shows = normalizeShows([
    event({ id: "E1", status: "canceled" }),
    event({ id: "E2", date: "2026-09-15", status: "cancelled" }),
    event({ id: "E3", date: "2026-09-16", status: "postponed" }),
    event({ id: "E4", date: "2026-09-17", status: "onsale" }),
  ])
  assert.deepEqual(shows.map((s) => s.id), ["E4"])
})

test("normalizeShows keeps rescheduled events and events without a status", () => {
  const shows = normalizeShows([
    event({ id: "E1", status: "rescheduled" }),
    event({ id: "E2", date: "2026-09-15" }),
  ])
  assert.deepEqual(shows.map((s) => s.id), ["E1", "E2"])
})

test("normalizeShows sorts by date ascending", () => {
  const shows = normalizeShows([
    event({ id: "E1", date: "2026-10-03", venue: "The Fillmore" }),
    event({ id: "E2", date: "2026-09-21", venue: "Madison Square Garden" }),
  ])
  assert.deepEqual(shows.map((s) => s.id), ["E2", "E1"])
})
