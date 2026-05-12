import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0"

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
    })
  }
  return map
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

// Wikipedia REST API fetch
type WikipediaResult = {
  extract: string
  thumbnailUrl: string | null
  pageUrl: string
} | null

async function fetchWikipedia(artistName: string): Promise<WikipediaResult> {
  try {
    const normalized = artistName
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
    const title = encodeURIComponent(normalized.replace(/\s+/g, "_"))
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
      { headers: { "Api-User-Agent": "EncoreAtlas/1.0" } },
    )
    if (!res.ok) return null

    const data = await res.json()
    if (data.type === "disambiguation") return null

    return {
      extract: data.extract ?? "",
      thumbnailUrl: data.thumbnail?.source ?? null,
      pageUrl:
        data.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${title}`,
    }
  } catch {
    return null
  }
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
      relatedArtists: Array.isArray(parsed.relatedArtists)
        ? parsed.relatedArtists
            .filter((r: unknown) => r && typeof (r as { name?: unknown }).name === "string")
            .map((r: { name: string; reason?: string }) => ({
              name: r.name,
              reason: typeof r.reason === "string" ? r.reason : "",
            }))
        : [],
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
  snippet: { title: string; description: string; publishedAt: string }
}

type YouTubeVideoDetail = {
  thumbnail: string | null
  viewCount: number | null
  publishedAt: string | null
  description: string | null
  duration: string | null
}

type ArtistContext = {
  genre: string[]
  city: string | null
  yearsActive: string | null
  knownFor: string[]
  associatedWith: string[]
  sceneSummary: string
  relatedArtists: Array<{ name: string; reason: string }>
}

type ClaudeTagResult = {
  tags: string[]
  blurb: string | null
  decade: string | null
  related_artists: string[]
  artist_context: ArtistContext | null
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
  videos: {
    id: string
    youtube_video_id: string
    title: string
    description: string | null
    thumbnail_url: string | null
    published_at: string | null
    view_count: number | null
    duration: string | null
    display_order: number
  }[]
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

    if (existingArtist && existingArtist.last_refreshed_at) {
      // Cache hit — return artist + videos
      const { data: videos } = await supabase
        .from("artist_videos")
        .select("*")
        .eq("artist_id", existingArtist.id)
        .order("display_order", { ascending: true })

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
        videos: (videos ?? []).map((v) => ({
          id: v.id,
          youtube_video_id: v.youtube_video_id,
          title: v.title,
          description: v.description,
          thumbnail_url: v.thumbnail_url,
          published_at: v.published_at,
          view_count: v.view_count,
          duration: v.duration,
          display_order: v.display_order,
        })),
        was_cache_hit: true,
      }

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // ── CACHE MISS — BUILD THE PAGE ──

    // Search YouTube with multiple query variations
    const searchQueries = [
      `${artist_name} live concert`,
      `${artist_name} full set`,
      `${artist_name} live performance`,
    ]

    const allResults: YouTubeSearchItem[] = []
    const seenVideoIds = new Set<string>()

    for (const query of searchQueries) {
      try {
        const items = await youtubeSearch(query, youtubeApiKey, 5)
        for (const item of items) {
          const videoId = item.id.videoId
          if (!seenVideoIds.has(videoId)) {
            seenVideoIds.add(videoId)
            allResults.push(item)
          }
        }
      } catch (err) {
        console.error(`YouTube search failed for "${query}":`, err)
      }

      // If we already have enough, stop early
      if (allResults.length >= 25) break
    }

    // If we have too few results, try one more variation
    if (allResults.length < 3) {
      try {
        const items = await youtubeSearch(
          `${artist_name} concert`,
          youtubeApiKey,
          5,
        )
        for (const item of items) {
          const videoId = item.id.videoId
          if (!seenVideoIds.has(videoId)) {
            seenVideoIds.add(videoId)
            allResults.push(item)
          }
        }
      } catch (err) {
        console.error("Fallback YouTube search failed:", err)
      }
    }

    // Cap at 25 videos
    const topResults = allResults.slice(0, 25)

    // Get video details (thumbnails, view counts)
    const videoIds = topResults.map((r) => r.id.videoId)
    const details = await youtubeVideoDetails(videoIds, youtubeApiKey)

    // Fetch Wikipedia for context, then pass to Claude for bio generation
    const videoTitles = topResults.map((r) => r.snippet.title)
    const wiki = await fetchWikipedia(artist_name)
    const tagResult = await claudeTag(
      artist_name, videoTitles, wiki?.extract ?? null, anthropicApiKey,
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
      const { error: updateError } = await supabase
        .from("artists")
        .update(artistData)
        .eq("id", existingArtist.id)

      if (updateError) {
        throw new Error(`Failed to update artist: ${updateError.message}`)
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

    // Insert videos
    const videoRows = topResults.map((item, index) => {
      const detail = details.get(item.id.videoId)
      return {
        artist_id: artistId,
        youtube_video_id: item.id.videoId,
        title: item.snippet.title,
        description: detail?.description ?? item.snippet.description ?? null,
        thumbnail_url: detail?.thumbnail ?? null,
        published_at: detail?.publishedAt ?? item.snippet.publishedAt ?? null,
        view_count: detail?.viewCount ?? null,
        duration: detail?.duration ? parseDuration(detail.duration) : null,
        search_query: `${artist_name} live concert`,
        display_order: index,
      }
    })

    if (videoRows.length > 0) {
      const { error: videoError } = await supabase
        .from("artist_videos")
        .upsert(videoRows, { onConflict: "artist_id,youtube_video_id" })

      if (videoError) {
        console.error("Failed to insert videos:", videoError)
      } else {
        // Only mark as fully built after videos are successfully persisted
        await supabase
          .from("artists")
          .update({ last_refreshed_at: new Date().toISOString() })
          .eq("id", artistId)
      }
    }

    // Return the built page
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
      videos: videoRows.map((v) => ({
        id: "", // generated by DB
        youtube_video_id: v.youtube_video_id,
        title: v.title,
        description: v.description,
        thumbnail_url: v.thumbnail_url,
        published_at: v.published_at,
        view_count: v.view_count,
        duration: v.duration,
        display_order: v.display_order,
      })),
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
