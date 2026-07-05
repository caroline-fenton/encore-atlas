import {
  normalizeShows,
  pickAttraction,
  type TicketmasterAttraction,
  type TicketmasterEvent,
} from "../_shared/ticketmaster.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const TICKETMASTER_BASE = "https://app.ticketmaster.com/discovery/v2"
const REQUEST_TIMEOUT_MS = 8000
// Enough to fill the sidebar after venue-night dedupe; the "all tour dates"
// link covers the long tail.
const MAX_EVENTS = 20

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

async function ticketmasterGet(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<unknown> {
  const search = new URLSearchParams({ ...params, apikey: apiKey })
  const res = await fetch(`${TICKETMASTER_BASE}/${path}?${search}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Ticketmaster ${path} failed (${res.status}): ${body}`)
  }
  return res.json()
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { artist_name } = await req.json()
    if (!artist_name || typeof artist_name !== "string") {
      return jsonResponse({ error: "artist_name is required" }, 400)
    }

    const apiKey = Deno.env.get("TICKETMASTER_API_KEY")
    if (!apiKey) {
      // Deployments without the secret degrade to "no shows" so the artist
      // page renders normally instead of surfacing an error.
      console.error("TICKETMASTER_API_KEY is not set; returning no shows")
      return jsonResponse({ shows: [], attraction_url: null })
    }

    const attractionData = await ticketmasterGet("attractions.json", {
      keyword: artist_name.trim(),
      classificationName: "Music",
      size: "5",
    }, apiKey) as { _embedded?: { attractions?: TicketmasterAttraction[] } }
    const attraction = pickAttraction(
      artist_name,
      attractionData._embedded?.attractions ?? [],
    )

    if (!attraction?.id) {
      return jsonResponse({ shows: [], attraction_url: null })
    }

    // The Discovery API can include events from earlier today; anchor the
    // window at the current instant. It rejects fractional seconds.
    const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
    const eventData = await ticketmasterGet("events.json", {
      attractionId: attraction.id,
      sort: "date,asc",
      size: String(MAX_EVENTS),
      startDateTime,
    }, apiKey) as { _embedded?: { events?: TicketmasterEvent[] } }

    return jsonResponse({
      shows: normalizeShows(eventData._embedded?.events ?? []),
      attraction_url: attraction.url ?? null,
    })
  } catch (err) {
    console.error("upcoming-shows error:", err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
    )
  }
})
