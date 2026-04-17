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
    part: "snippet,statistics",
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
    })
  }
  return map
}

// Claude API call for tagging + blurb
async function claudeTag(
  artistName: string,
  videoTitles: string[],
  apiKey: string,
): Promise<ClaudeTagResult> {
  const prompt = `You are a music expert. Given the artist name and a list of their live performance video titles from YouTube, provide the following as a JSON object:

1. "tags": An array of 3-7 genre/style tags (lowercase, e.g. ["jazz", "fusion", "instrumental"])
2. "blurb": A 2-3 sentence description of the artist suitable for a concert discovery page. Focus on their live performance style and what makes their shows special.
3. "decade": The primary decade they were/are most active (e.g. "1990s", "2010s")
4. "related_artists": An array of 3-5 related artist names that fans would also enjoy seeing live

Artist: ${artistName}
Video titles:
${videoTitles.map((t) => `- ${t}`).join("\n")}

Respond with ONLY valid JSON, no markdown formatting or code blocks.`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Claude API error (${res.status}): ${body}`)
    return { tags: [], blurb: null, decade: null, related_artists: [] }
  }

  const data = await res.json()
  const raw = data.content?.[0]?.text ?? ""

  // Strip markdown code fences if Claude wraps the response
  const text = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")

  try {
    const parsed = JSON.parse(text)
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      blurb: typeof parsed.blurb === "string" ? parsed.blurb : null,
      decade: typeof parsed.decade === "string" ? parsed.decade : null,
      related_artists: Array.isArray(parsed.related_artists)
        ? parsed.related_artists
        : [],
    }
  } catch {
    console.error("Failed to parse Claude response:", text)
    return { tags: [], blurb: null, decade: null, related_artists: [] }
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
}

type ClaudeTagResult = {
  tags: string[]
  blurb: string | null
  decade: string | null
  related_artists: string[]
}

type ArtistPageResponse = {
  artist: {
    id: string
    name: string
    tags: string[] | null
    blurb: string | null
    decade: string | null
    related_artists: string[] | null
    is_curated: boolean
  }
  videos: {
    id: string
    youtube_video_id: string
    title: string
    description: string | null
    thumbnail_url: string | null
    published_at: string | null
    view_count: number | null
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
          decade: existingArtist.decade,
          related_artists: existingArtist.related_artists,
          is_curated: existingArtist.is_curated,
        },
        videos: (videos ?? []).map((v) => ({
          id: v.id,
          youtube_video_id: v.youtube_video_id,
          title: v.title,
          description: v.description,
          thumbnail_url: v.thumbnail_url,
          published_at: v.published_at,
          view_count: v.view_count,
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

    // Call Claude for tagging
    const videoTitles = topResults.map((r) => r.snippet.title)
    const tagResult = await claudeTag(artist_name, videoTitles, anthropicApiKey)

    // ── WRITE TO DATABASE ──

    // Upsert artist record
    const artistData = {
      name: normalizedName,
      tags: tagResult.tags,
      tag_source: "llm" as const,
      blurb: tagResult.blurb,
      decade: tagResult.decade,
      related_artists: tagResult.related_artists,
      discovered_by: userId,
      last_refreshed_at: new Date().toISOString(),
    }

    let artistId: string

    if (existingArtist) {
      // Artist row exists but wasn't fully built — update it
      const { error: updateError } = await supabase
        .from("artists")
        .update(artistData)
        .eq("id", existingArtist.id)

      if (updateError) {
        console.error("Failed to update artist:", updateError)
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
      }
    }

    // Return the built page
    const response: ArtistPageResponse = {
      artist: {
        id: artistId,
        name: normalizedName,
        tags: tagResult.tags,
        blurb: tagResult.blurb,
        decade: tagResult.decade,
        related_artists: tagResult.related_artists,
        is_curated: false,
      },
      videos: videoRows.map((v) => ({
        id: "", // generated by DB
        youtube_video_id: v.youtube_video_id,
        title: v.title,
        description: v.description,
        thumbnail_url: v.thumbnail_url,
        published_at: v.published_at,
        view_count: v.view_count,
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
