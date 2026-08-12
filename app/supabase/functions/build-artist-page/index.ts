import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0"
import { getAliases } from "../../../src/data/artistAliases.ts"
import { decodeHtml } from "../../../src/utils/decodeHtml.ts"
import { fetchWikipediaSummary } from "../../../src/utils/wikipedia.ts"
import {
  filterRelatedArtists,
  hasMixedScript,
  isSameArtistName,
  normalizeArtistName,
} from "../../../src/utils/artistNameFilters.ts"
import {
  MAX_LOOKUPS,
  verifyArtistNames,
  verifySubjectArtist,
} from "../_shared/musicbrainz.ts"
import { dedupeVideosAcrossTypes, type RefreshVideo } from "../_shared/refresh-policy.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

// YouTube Data API search
async function youtubeSearch(
  query: string,
  apiKey: string,
  maxResults = 10,
): Promise<YouTubeSearchItem[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    maxResults: String(maxResults),
    videoDuration: "any",
    order: "relevance",
    key: apiKey,
  })

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`YouTube search failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data.items ?? []
}

// YouTube video details for thumbnails and view counts
async function youtubeVideoDetails(
  videoIds: string[],
  apiKey: string,
): Promise<Map<string, YouTubeVideoDetail>> {
  if (videoIds.length === 0) return new Map()

  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics",
    id: videoIds.join(","),
    key: apiKey,
  })

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params}`,
  )
  if (!res.ok) return new Map()

  const data = await res.json()
  const map = new Map<string, YouTubeVideoDetail>()
  for (const item of data.items ?? []) {
    map.set(item.id, {
      thumbnail:
        item.snippet?.thumbnails?.maxres?.url ??
        item.snippet?.thumbnails?.high?.url ??
        item.snippet?.thumbnails?.medium?.url ??
        null,
      viewCount: item.statistics?.viewCount
        ? parseInt(item.statistics.viewCount, 10)
        : null,
      publishedAt: item.snippet?.publishedAt ?? null,
      description: item.snippet?.description ?? null,
      duration: item.contentDetails?.duration ?? null,
      channelTitle: item.snippet?.channelTitle ?? null,
    })
  }
  return map
}

// --- Relevance filtering (mirrors src/services/youtube.ts) ---

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "")
}

function matchesArtistName(text: string, textNorm: string, name: string): boolean {
  const stripped = name.replace(/^the\s+/, "")
  const strippedNorm = normalizeForMatch(stripped)
  const nameNorm = normalizeForMatch(name)

  return (
    text.includes(stripped) ||
    text.includes(name) ||
    (strippedNorm !== "" && textNorm.includes(strippedNorm)) ||
    (nameNorm !== "" && textNorm.includes(nameNorm))
  )
}

function isRelevantResult(item: YouTubeSearchItem, artistName: string): boolean {
  const title = decodeHtml(item.snippet.title).toLowerCase()
  const titleNorm = normalizeForMatch(title)
  const channel = decodeHtml(item.snippet.channelTitle).toLowerCase()
  const channelNorm = normalizeForMatch(channel)

  const names = [artistName.toLowerCase(), ...getAliases(artistName).map((a) => a.toLowerCase())]

  return names.some(
    (name) =>
      matchesArtistName(title, titleNorm, name) || matchesArtistName(channel, channelNorm, name),
  )
}

function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ""
  const hours = parseInt(match[1] || "0", 10)
  const minutes = parseInt(match[2] || "0", 10)
  const seconds = parseInt(match[3] || "0", 10)
  const pad = (n: number) => n.toString().padStart(2, "0")
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${minutes}:${pad(seconds)}`
}

// Claude API call for artist context
async function claudeTag(
  artistName: string,
  videoTitles: string[],
  wikipediaExtract: string | null,
  apiKey: string,
): Promise<ClaudeTagResult> {
  const wikiContext = wikipediaExtract
    ? `\nWikipedia summary (use as factual reference, do not copy verbatim):\n${wikipediaExtract}\n`
    : ""

  const prompt = `
You are generating concise artist context for Encore Atlas, a music rabbit-hole and live performance discovery app.

Artist: ${artistName}

Video titles from YouTube (for context):
${videoTitles.map((t) => `- ${t}`).join("\n")}
${wikiContext}
Return ONLY valid JSON. Do not include markdown.

Use this schema:
{
  "genre": string[],
  "city": string | null,
  "yearsActive": string | null,
  "knownFor": string[],
  "associatedWith": string[],
  "sceneSummary": string,
  "relatedArtists": [
    {
      "name": string,
      "reason": string
    }
  ]
}

Guidelines:
- Keep the tone editorial, specific, and music-literate.
- Avoid generic biography language like "is an American band formed in..."
- Focus on scenes, eras, live energy, cultural adjacency, and rabbit-hole usefulness.
- "genre" should be 2-5 concise labels.
- "knownFor" should be 3-5 short phrases.
- "associatedWith" can include scenes, eras, labels, cities, movements, or adjacent artists.
- "sceneSummary" should be 1-2 sentences max.
- "relatedArtists" should include 8-12 artists a curious listener might search next.
- For each related artist, give a short reason under 12 words.
- Every related artist must be a real, established act you are confident exists (the kind with a MusicBrainz or Wikipedia entry). If you are not sure an artist exists, leave them out — a shorter list of real artists beats a longer list with inventions.
- Never include ${artistName} itself in "relatedArtists".
- Write each artist name exactly as the artist is officially known, in one consistent script — never mix scripts or languages within a single name (e.g. do not combine Arabic and Latin words in one name).
- If you are uncertain about a field, use null or a cautious phrase rather than inventing facts.
- Do not copy text from Wikipedia or any source verbatim.
`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      // Structured outputs: the response is guaranteed to be valid JSON
      // matching this schema, so parsing can no longer fail on prose or
      // markdown fences.
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              genre: { type: "array", items: { type: "string" } },
              city: { anyOf: [{ type: "string" }, { type: "null" }] },
              yearsActive: { anyOf: [{ type: "string" }, { type: "null" }] },
              knownFor: { type: "array", items: { type: "string" } },
              associatedWith: { type: "array", items: { type: "string" } },
              sceneSummary: { type: "string" },
              relatedArtists: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["name", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: [
              "genre",
              "city",
              "yearsActive",
              "knownFor",
              "associatedWith",
              "sceneSummary",
              "relatedArtists",
            ],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Claude API error (${res.status}): ${body}`)
    return { tags: [], blurb: null, decade: null, related_artists: [], artist_context: null }
  }

  const data = await res.json()
  const raw = data.content?.[0]?.text ?? ""

  // Strip markdown code fences if Claude wraps the response
  const text = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")

  try {
    const parsed = JSON.parse(text)

    const artist_context: ArtistContext = {
      genre: Array.isArray(parsed.genre) ? parsed.genre : [],
      city: typeof parsed.city === "string" ? parsed.city : null,
      yearsActive: typeof parsed.yearsActive === "string" ? parsed.yearsActive : null,
      knownFor: Array.isArray(parsed.knownFor) ? parsed.knownFor : [],
      associatedWith: Array.isArray(parsed.associatedWith) ? parsed.associatedWith : [],
      sceneSummary: typeof parsed.sceneSummary === "string" ? parsed.sceneSummary : "",
      // Deterministic cleanup before any DB write: drops self-references,
      // mixed-script names ("راديو head"), empties, and duplicates. Capped
      // at MAX_LOOKUPS so every persisted name gets a MusicBrainz check —
      // the prompt's 8-12 range is advisory, not schema-enforced.
      relatedArtists: filterRelatedArtists(
        artistName,
        Array.isArray(parsed.relatedArtists)
          ? parsed.relatedArtists
              .filter((r: unknown) => r && typeof (r as { name?: unknown }).name === "string")
              .map((r: { name: string; reason?: string }) => ({
                name: r.name,
                reason: typeof r.reason === "string" ? r.reason : "",
              }))
          : [],
      ).slice(0, MAX_LOOKUPS),
    }

    return {
      tags: artist_context.genre,
      blurb: artist_context.sceneSummary || null,
      decade: null,
      related_artists: artist_context.relatedArtists.map((r) => r.name),
      artist_context,
    }
  } catch {
    console.error("Failed to parse Claude response:", text)
    return { tags: [], blurb: null, decade: null, related_artists: [], artist_context: null }
  }
}

// Types
type YouTubeSearchItem = {
  id: { videoId: string }
  snippet: { title: string; description: string; publishedAt: string; channelTitle: string }
}

type YouTubeVideoDetail = {
  thumbnail: string | null
  viewCount: number | null
  publishedAt: string | null
  description: string | null
  duration: string | null
  channelTitle: string | null
}

type ArtistContext = {
  genre: string[]
  city: string | null
  yearsActive: string | null
  knownFor: string[]
  associatedWith: string[]
  sceneSummary: string
  relatedArtists: Array<{ name: string; reason: string }>
  epicTemplate?: {
    enabled: boolean
    heroImageUrl: string | null
    tagline: string | null
    featuredEra: string | null
    featuredLiveMoment: string | null
    introCopy: string | null
  } | null
}

type ClaudeTagResult = {
  tags: string[]
  blurb: string | null
  decade: string | null
  related_artists: string[]
  artist_context: ArtistContext | null
}

type VideoRow = {
  id: string
  youtube_video_id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  published_at: string | null
  view_count: number | null
  duration: string | null
  display_order: number
  channel_title: string | null
}

type ArtistPageResponse = {
  artist: {
    id: string
    name: string
    tags: string[] | null
    blurb: string | null
    bio: string | null
    bio_image_url: string | null
    decade: string | null
    related_artists: string[] | null
    is_curated: boolean
    artist_context: ArtistContext | null
  }
  videos: VideoRow[]
  interview_videos: VideoRow[]
  music_videos: VideoRow[]
  // Whether the interview/music_video categories have been searched and
  // persisted (even if zero relevant results were found). Lets the
  // frontend distinguish "completed, genuinely empty" from "never
  // attempted" (legacy artists, or artists with too few concert videos).
  interviews_synced: boolean
  music_videos_synced: boolean
  was_cache_hit: boolean
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { artist_name } = await req.json()
    if (!artist_name || typeof artist_name !== "string") {
      return new Response(
        JSON.stringify({ error: "artist_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const normalizedName = artist_name.trim().toLowerCase()

    // Initialize Supabase client with the user's auth token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY")!
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Also create a client with the user's auth for discovered_by
    const authHeader = req.headers.get("Authorization")
    let userId: string | null = null
    if (authHeader) {
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      )
      const { data: { user } } = await userClient.auth.getUser()
      userId = user?.id ?? null
    }

    // ── CACHE CHECK ──
    const { data: existingArtist } = await supabase
      .from("artists")
      .select("*")
      .ilike("name", normalizedName.replace(/%/g, "\\%").replace(/_/g, "\\_"))
      .maybeSingle()

    if (
      existingArtist
      && (existingArtist.last_refreshed_at || existingArtist.is_curated)
    ) {
      // Curated rows are always treated as complete so the public lazy builder
      // can never overwrite them. Return cached videos grouped by type.
      const { data: allVideos } = await supabase
        .from("artist_videos")
        .select("*")
        .eq("artist_id", existingArtist.id)
        .order("display_order", { ascending: true })

      const toVideoRow = (v: Record<string, unknown>): VideoRow => ({
        id: v.id as string,
        youtube_video_id: v.youtube_video_id as string,
        title: v.title as string,
        description: v.description as string | null,
        thumbnail_url: v.thumbnail_url as string | null,
        published_at: v.published_at as string | null,
        view_count: v.view_count as number | null,
        duration: v.duration as string | null,
        display_order: v.display_order as number,
        channel_title: (v.channel_title as string | null) ?? null,
      })

      const byType = (type: string) =>
        (allVideos ?? []).filter((v) => (v.video_type ?? "concert") === type).map(toVideoRow)

      const syncedTypes: string[] = existingArtist.video_types_synced ?? []

      const response: ArtistPageResponse = {
        artist: {
          id: existingArtist.id,
          name: existingArtist.name,
          tags: existingArtist.tags,
          blurb: existingArtist.blurb,
          bio: existingArtist.bio,
          bio_image_url: existingArtist.wikipedia_thumbnail_url,
          decade: existingArtist.decade,
          related_artists: existingArtist.related_artists,
          is_curated: existingArtist.is_curated,
          artist_context: existingArtist.artist_context as ArtistContext | null,
        },
        videos: byType("concert"),
        interview_videos: byType("interview"),
        music_videos: byType("music_video"),
        interviews_synced: syncedTypes.includes("interview"),
        music_videos_synced: syncedTypes.includes("music_video"),
        was_cache_hit: true,
      }

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // ── SUBJECT VALIDATION ──
    // Runs only on cache misses, so curated and already-built artists are
    // never re-validated. Blocks junk subject names (stale links, search
    // history pointing at deleted pages) from rebuilding garbage rows.
    const rejectUnknownArtist = () =>
      new Response(
        JSON.stringify({
          error: "artist_not_found",
          message: `No artist found matching "${artist_name}"`,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )

    if (hasMixedScript(artist_name)) {
      return rejectUnknownArtist()
    }

    // Existence check against MusicBrainz: a definitive miss rejects the
    // build, while a transport failure fails open so MusicBrainz downtime
    // can't take page building down with it. The canonical name is
    // deliberately NOT swapped into the stored row — the ilike cache check
    // above and artistNameLookupVariants in src/services/artistPage.ts both
    // match on the user's normalized input, and a stored name that
    // normalizes differently (e.g. "sigur rós" for input "sigur ros") would
    // make the row unfindable and trigger a rebuild on every visit.
    const subjectVerification = await verifySubjectArtist(artist_name)
    if (subjectVerification.status === "not_found") {
      return rejectUnknownArtist()
    }

    // ── CACHE MISS — BUILD THE PAGE ──

    // Single concert search query — multiple overlapping variations add quota
    // cost without meaningfully increasing unique results.
    let concertResults: YouTubeSearchItem[] = []
    try {
      concertResults = await youtubeSearch(
        `${artist_name} live concert full set`,
        youtubeApiKey,
        25,
      )
    } catch (err) {
      console.error("Concert YouTube search failed:", err)
    }

    // Cap at 25 videos, filtering out results that don't appear to be
    // about this artist (e.g. unrelated videos that surface for broad
    // "live concert full set" queries).
    const topResults = concertResults
      .filter((item) => isRelevantResult(item, artist_name))
      .slice(0, 25)

    // Get video details (thumbnails, view counts)
    const videoIds = topResults.map((r) => r.id.videoId)
    const details = await youtubeVideoDetails(videoIds, youtubeApiKey)

    // Fetch Wikipedia for context, then pass to Claude for bio generation
    const videoTitles = topResults.map((r) => decodeHtml(r.snippet.title))
    const wiki = await fetchWikipediaSummary(artist_name).catch(() => null)
    const tagResult = await claudeTag(
      artist_name, videoTitles, wiki?.extract ?? null, anthropicApiKey,
    )

    // Verify Claude's related-artist suggestions against MusicBrainz.
    // Lookups are paced at ~1/s, so start now and await after the video
    // writes below to hide most of the latency.
    const verifiedNamesPromise = verifyArtistNames(
      tagResult.artist_context?.relatedArtists.map((r) => r.name) ?? [],
    )

    // ── WRITE TO DATABASE ──

    // Write artist metadata without last_refreshed_at yet — that only gets
    // set after videos are successfully persisted, so a build with zero
    // videos (transient API failure) isn't treated as a completed build.
    const artistData = {
      name: normalizedName,
      tags: tagResult.tags,
      tag_source: "llm" as const,
      blurb: tagResult.blurb,
      decade: tagResult.decade,
      related_artists: tagResult.related_artists,
      bio_metadata: null,
      artist_context: tagResult.artist_context,
      wikipedia_extract: wiki?.extract ?? null,
      wikipedia_thumbnail_url: wiki?.thumbnailUrl ?? null,
      wikipedia_url: wiki?.pageUrl ?? null,
      discovered_by: userId,
    }

    let artistId: string

    if (existingArtist) {
      // Artist row exists but wasn't fully built — update it
      const { data: updatedArtists, error: updateError } = await supabase
        .from("artists")
        .update(artistData)
        .eq("id", existingArtist.id)
        .eq("is_curated", false)
        .select("id")

      if (updateError) {
        throw new Error(`Failed to update artist: ${updateError.message}`)
      }
      if (!updatedArtists?.length) {
        throw new Error("Artist was curated while the public build was running")
      }
      artistId = existingArtist.id
    } else {
      // Insert new artist
      const { data: newArtist, error: insertError } = await supabase
        .from("artists")
        .insert([artistData])
        .select("id")
        .single()

      if (insertError) {
        // Race condition — another request may have inserted
        if (insertError.code === "23505") {
          const { data: raceArtist } = await supabase
            .from("artists")
            .select("id")
            .ilike(
              "name",
              normalizedName.replace(/%/g, "\\%").replace(/_/g, "\\_"),
            )
            .single()
          artistId = raceArtist!.id
        } else {
          throw new Error(`Failed to insert artist: ${insertError.message}`)
        }
      } else {
        artistId = newArtist.id
      }
    }

    // Insert concert videos
    const concertRows = topResults.map((item, index) => {
      const detail = details.get(item.id.videoId)
      return {
        artist_id: artistId,
        youtube_video_id: item.id.videoId,
        // search snippet fields are HTML-escaped by the YouTube API; videos.list details are not
        title: decodeHtml(item.snippet.title),
        description:
          detail?.description ??
          (item.snippet.description ? decodeHtml(item.snippet.description) : null),
        thumbnail_url: detail?.thumbnail ?? null,
        published_at: detail?.publishedAt ?? item.snippet.publishedAt ?? null,
        view_count: detail?.viewCount ?? null,
        duration: detail?.duration ? parseDuration(detail.duration) : null,
        channel_title:
          detail?.channelTitle ??
          (item.snippet.channelTitle ? decodeHtml(item.snippet.channelTitle) : null),
        search_query: `${artist_name} live concert full set`,
        is_manually_added: false,
        display_order: index,
        video_type: "concert",
      }
    })

    let concertWriteOk = false
    if (concertRows.length > 0) {
      const { error: videoError } = await supabase.rpc(
        "upsert_public_build_videos",
        { p_artist_id: artistId, p_videos: concertRows },
      )

      if (videoError) {
        throw new Error(`Failed to insert concert videos: ${videoError.message}`)
      }
      concertWriteOk = true
    }

    // Only search for interviews and music videos for artists with enough
    // YouTube presence — obscure artists won't have this content and it's
    // not worth burning quota to find out.
    const needsSecondarySearches = concertRows.length >= 3
    const secondaryRows: Record<string, ReturnType<typeof toBuiltVideoRow>[]> = {
      interview: [],
      music_video: [],
    }
    // Categories that were searched and successfully persisted (regardless
    // of whether any relevant results were found). Used to distinguish
    // "completed, genuinely empty" from "never attempted".
    const syncedTypes: string[] = []

    function toBuiltVideoRow(v: {
      youtube_video_id: string
      title: string
      description: string | null
      thumbnail_url: string | null
      published_at: string | null
      view_count: number | null
      duration: string | null
      channel_title: string | null
      display_order: number
    }): VideoRow {
      return {
        id: "",
        youtube_video_id: v.youtube_video_id,
        title: v.title,
        description: v.description,
        thumbnail_url: v.thumbnail_url,
        published_at: v.published_at,
        view_count: v.view_count,
        duration: v.duration,
        display_order: v.display_order,
        channel_title: v.channel_title,
      }
    }

    if (needsSecondarySearches) {
      const secondarySearches: Array<{ query: string; type: "interview" | "music_video" }> = [
        { query: `${artist_name} interview`, type: "interview" },
        { query: `${artist_name} official music video`, type: "music_video" },
      ]

      // Search results are gathered for both types before anything is
      // written so a video that satisfies two queries (e.g. a live set that
      // also reads as an "official" video) can be deduped across them —
      // see the merge below.
      const secondaryCandidates: Partial<Record<"interview" | "music_video", RefreshVideo[]>> = {}

      for (const { query, type } of secondarySearches) {
        try {
          const items = (await youtubeSearch(query, youtubeApiKey, 25))
            .filter((item) => isRelevantResult(item, artist_name))
          const ids = items.map((i) => i.id.videoId)
          const typeDetails = await youtubeVideoDetails(ids, youtubeApiKey)

          secondaryCandidates[type] = items.map((item, index) => {
            const detail = typeDetails.get(item.id.videoId)
            return {
              youtube_video_id: item.id.videoId,
              title: decodeHtml(item.snippet.title),
              description:
                detail?.description ??
                (item.snippet.description ? decodeHtml(item.snippet.description) : null),
              thumbnail_url: detail?.thumbnail ?? null,
              published_at: detail?.publishedAt ?? item.snippet.publishedAt ?? null,
              view_count: detail?.viewCount ?? null,
              duration: detail?.duration ? parseDuration(detail.duration) : null,
              channel_title:
                detail?.channelTitle ??
                (item.snippet.channelTitle ? decodeHtml(item.snippet.channelTitle) : null),
              search_query: query,
              is_manually_added: false,
              display_order: index,
              video_type: type,
            }
          })
        } catch (err) {
          if (
            err instanceof Error
            && err.message.includes("Artist was curated while the public build was running")
          ) {
            throw err
          }
          console.error(`YouTube search failed for ${type}:`, err)
        }
      }

      // A video that satisfies two of these queries stays in concert if it's
      // already there; otherwise interview wins over music_video by default.
      // dedupeVideosAcrossTypes only groups duplicates within its first
      // argument, so concertRows must be included there too — passing it
      // only as existingVideos wouldn't catch a video that matches concert
      // plus exactly one secondary type (no group of size >1 would ever
      // form). Concert-typed winners are dropped below by the per-type
      // filter, since concertRows were already persisted separately above.
      const dedupedSecondary = dedupeVideosAcrossTypes(
        [
          ...concertRows,
          ...(secondaryCandidates.interview ?? []),
          ...(secondaryCandidates.music_video ?? []),
        ],
        concertRows,
      )

      for (const type of ["interview", "music_video"] as const) {
        // The search itself failed — leave this category unattempted rather
        // than recording it as synced with (falsely) zero results.
        if (!secondaryCandidates[type]) continue

        const rows = dedupedSecondary
          .filter((video) => video.video_type === type)
          .map((video) => ({ ...video, artist_id: artistId }))

        try {
          if (rows.length > 0) {
            const { error } = await supabase.rpc(
              "upsert_public_build_videos",
              { p_artist_id: artistId, p_videos: rows },
            )
            if (error) {
              throw new Error(`Failed to insert ${type} videos: ${error.message}`)
            }
          }

          syncedTypes.push(type)
          secondaryRows[type] = rows.map(toBuiltVideoRow)
        } catch (err) {
          if (
            err instanceof Error
            && err.message.includes("Artist was curated while the public build was running")
          ) {
            throw err
          }
          console.error(`YouTube search failed for ${type}:`, err)
        }
      }
    }

    // Resolve the MusicBrainz checks: keep only suggestions that map to a
    // real artist, swap in the canonical name ("radio head" → "Radiohead"),
    // and re-check for self-references and duplicates introduced by
    // canonicalization.
    const verifiedNames = await verifiedNamesPromise
    if (tagResult.artist_context) {
      const seen = new Set<string>()
      const verified: Array<{ name: string; reason: string }> = []
      for (const related of tagResult.artist_context.relatedArtists) {
        const canonical = verifiedNames.get(related.name)
        if (!canonical) continue // MusicBrainz has no such artist
        if (isSameArtistName(canonical, artist_name)) continue
        const key = normalizeArtistName(canonical)
        if (seen.has(key)) continue
        seen.add(key)
        verified.push({ name: canonical, reason: related.reason })
      }
      tagResult.artist_context.relatedArtists = verified
      tagResult.related_artists = verified.map((r) => r.name)

      // The initial artist write ran before verification finished, so swap
      // in the verified values now — unconditionally, not just on completed
      // builds, or a build with zero concert videos would leave unverified
      // names in the row.
      const { error: verifiedWriteError } = await supabase
        .from("artists")
        .update({
          related_artists: tagResult.related_artists,
          artist_context: tagResult.artist_context,
        })
        .eq("id", artistId)
        .eq("is_curated", false)
      if (verifiedWriteError) {
        throw new Error(
          `Failed to persist verified related artists: ${verifiedWriteError.message}`,
        )
      }
    }

    // Mark as fully built once concert videos are persisted, recording which
    // secondary categories were successfully synced so the frontend can
    // fall back to live search only for categories that were never
    // attempted (rather than ones that completed with zero results).
    if (concertWriteOk) {
      const { data: completedArtists, error: completeError } = await supabase
        .from("artists")
        .update({
          last_refreshed_at: new Date().toISOString(),
          video_types_synced: syncedTypes,
        })
        .eq("id", artistId)
        .eq("is_curated", false)
        .select("id")
      if (completeError) {
        throw new Error(`Failed to complete artist build: ${completeError.message}`)
      }
      if (!completedArtists?.length) {
        throw new Error("Artist was curated while the public build was running")
      }
    }

    const response: ArtistPageResponse = {
      artist: {
        id: artistId,
        name: normalizedName,
        tags: tagResult.tags,
        blurb: tagResult.blurb,
        bio: tagResult.bio,
        bio_image_url: wiki?.thumbnailUrl ?? null,
        decade: tagResult.decade,
        related_artists: tagResult.related_artists,
        is_curated: false,
        artist_context: tagResult.artist_context,
      },
      videos: concertRows.map(toBuiltVideoRow),
      interview_videos: secondaryRows.interview,
      music_videos: secondaryRows.music_video,
      interviews_synced: syncedTypes.includes("interview"),
      music_videos_synced: syncedTypes.includes("music_video"),
      was_cache_hit: false,
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("build-artist-page error:", err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})
