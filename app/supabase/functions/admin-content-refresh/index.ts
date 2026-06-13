import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0"
import {
  applyManualArtistEdits,
  concertVideos,
  normalizeVideoOrder,
  parseYouTubeVideoId,
  validatePublishRequest,
  type RefreshScope,
  type RefreshVideo,
} from "../_shared/refresh-policy.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

type ArtistRow = {
  id: string
  name: string
  tags: string[] | null
  tag_source: string | null
  blurb: string | null
  bio: string | null
  decade: string | null
  related_artists: string[] | null
  youtube_channel_id: string | null
  musicbrainz_id: string | null
  is_curated: boolean
  discovered_by: string | null
  created_at: string
  last_refreshed_at: string | null
  bio_metadata: unknown
  artist_context: ArtistContext | null
  wikipedia_extract: string | null
  wikipedia_thumbnail_url: string | null
  wikipedia_url: string | null
}

type Snapshot = {
  artist: ArtistRow
  videos: Array<RefreshVideo & { id?: string; artist_id?: string; created_at?: string }>
  manual_video_replacements?: string[]
}

type YouTubeSearchItem = {
  id: { videoId: string }
  snippet: { title: string; description: string; publishedAt: string }
}

type YouTubeVideoDetail = {
  title: string
  description: string | null
  thumbnail: string | null
  viewCount: number | null
  publishedAt: string | null
  duration: string | null
  channelTitle: string | null
}

type GeneratedContext = {
  tags: string[]
  blurb: string | null
  related_artists: string[]
  artist_context: ArtistContext
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (
    error
    && typeof error === "object"
    && "message" in error
    && typeof error.message === "string"
  ) {
    return error.message
  }
  return "Internal error"
}

function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ""
  const hours = parseInt(match[1] || "0", 10)
  const minutes = parseInt(match[2] || "0", 10)
  const seconds = parseInt(match[3] || "0", 10)
  const pad = (value: number) => value.toString().padStart(2, "0")
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`
}

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
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
  )
  if (!response.ok) {
    throw new Error(`YouTube search failed (${response.status})`)
  }
  const data = await response.json()
  return data.items ?? []
}

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
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params}`,
  )
  if (!response.ok) {
    throw new Error(`YouTube video lookup failed (${response.status})`)
  }

  const data = await response.json()
  const details = new Map<string, YouTubeVideoDetail>()
  for (const item of data.items ?? []) {
    details.set(item.id, {
      title: item.snippet?.title ?? item.id,
      description: item.snippet?.description ?? null,
      thumbnail:
        item.snippet?.thumbnails?.maxres?.url
        ?? item.snippet?.thumbnails?.high?.url
        ?? item.snippet?.thumbnails?.medium?.url
        ?? null,
      viewCount: item.statistics?.viewCount
        ? parseInt(item.statistics.viewCount, 10)
        : null,
      publishedAt: item.snippet?.publishedAt ?? null,
      duration: item.contentDetails?.duration
        ? parseDuration(item.contentDetails.duration)
        : null,
      channelTitle: item.snippet?.channelTitle ?? null,
    })
  }
  return details
}

async function generateVideos(
  artistName: string,
  apiKey: string,
): Promise<RefreshVideo[]> {
  const queries = [
    `${artistName} live concert`,
    `${artistName} full set`,
    `${artistName} live performance`,
  ]
  const results: Array<YouTubeSearchItem & { searchQuery: string }> = []
  const seen = new Set<string>()

  for (const query of queries) {
    const items = await youtubeSearch(query, apiKey, 8)
    for (const item of items) {
      if (!seen.has(item.id.videoId)) {
        seen.add(item.id.videoId)
        results.push({ ...item, searchQuery: query })
      }
    }
  }

  const selected = results.slice(0, 25)
  const details = await youtubeVideoDetails(
    selected.map((item) => item.id.videoId),
    apiKey,
  )

  return selected.map((item, display_order) => {
    const detail = details.get(item.id.videoId)
    return {
      youtube_video_id: item.id.videoId,
      title: detail?.title ?? item.snippet.title,
      description: detail?.description ?? item.snippet.description ?? null,
      thumbnail_url: detail?.thumbnail ?? null,
      published_at: detail?.publishedAt ?? item.snippet.publishedAt ?? null,
      view_count: detail?.viewCount ?? null,
      duration: detail?.duration ?? null,
      search_query: item.searchQuery,
      is_manually_added: false,
      display_order,
      video_type: "concert",
      channel_title: detail?.channelTitle ?? null,
    }
  })
}

async function fetchWikipedia(artistName: string) {
  const normalized = artistName.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  const title = encodeURIComponent(normalized.replace(/\s+/g, "_"))
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
    { headers: { "Api-User-Agent": "EncoreAtlas/1.0" } },
  )
  if (!response.ok) return null
  const data = await response.json()
  if (data.type === "disambiguation") return null
  return {
    extract: data.extract ?? "",
    thumbnailUrl: data.thumbnail?.source ?? null,
    pageUrl:
      data.content_urls?.desktop?.page
      ?? `https://en.wikipedia.org/wiki/${title}`,
  }
}

async function generateContext(
  artistName: string,
  videoTitles: string[],
  wikipediaExtract: string | null,
  apiKey: string,
): Promise<GeneratedContext> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `
Generate concise artist context for Encore Atlas, a music discovery app.

Artist: ${artistName}
Video titles:
${videoTitles.map((title) => `- ${title}`).join("\n")}
Wikipedia summary for factual reference:
${wikipediaExtract ?? "Unavailable"}

Return only valid JSON using this schema:
{
  "genre": string[],
  "city": string | null,
  "yearsActive": string | null,
  "knownFor": string[],
  "associatedWith": string[],
  "sceneSummary": string,
  "relatedArtists": [{ "name": string, "reason": string }]
}

Use 2-5 concise genre labels, 3-5 known-for phrases, a 1-2 sentence
scene summary, and 8-12 useful related artists. Do not copy source text.
`,
      }],
    }),
  })
  if (!response.ok) {
    throw new Error(`Claude generation failed (${response.status})`)
  }

  const data = await response.json()
  const raw = data.content?.[0]?.text ?? ""
  const parsed = JSON.parse(
    raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, ""),
  )
  const artist_context: ArtistContext = {
    genre: Array.isArray(parsed.genre) ? parsed.genre : [],
    city: typeof parsed.city === "string" ? parsed.city : null,
    yearsActive: typeof parsed.yearsActive === "string" ? parsed.yearsActive : null,
    knownFor: Array.isArray(parsed.knownFor) ? parsed.knownFor : [],
    associatedWith: Array.isArray(parsed.associatedWith) ? parsed.associatedWith : [],
    sceneSummary: typeof parsed.sceneSummary === "string" ? parsed.sceneSummary : "",
    relatedArtists: Array.isArray(parsed.relatedArtists)
      ? parsed.relatedArtists
        .filter((item: unknown) =>
          item && typeof (item as { name?: unknown }).name === "string"
        )
        .map((item: { name: string; reason?: string }) => ({
          name: item.name,
          reason: typeof item.reason === "string" ? item.reason : "",
        }))
      : [],
  }
  return {
    tags: artist_context.genre,
    blurb: artist_context.sceneSummary || null,
    related_artists: artist_context.relatedArtists.map((artist) => artist.name),
    artist_context,
  }
}

function mergeManualVideos(
  generated: RefreshVideo[],
  existing: Snapshot["videos"],
): RefreshVideo[] {
  const merged = [...generated]
  const manualVideos = existing
    .filter((video) =>
      (video.video_type ?? "concert") === "concert"
      && video.is_manually_added
    )
    .sort((a, b) => a.display_order - b.display_order)

  for (const manual of manualVideos) {
    const withoutDuplicate = merged.filter(
      (video) => video.youtube_video_id !== manual.youtube_video_id,
    )
    const index = Math.min(manual.display_order, withoutDuplicate.length)
    withoutDuplicate.splice(index, 0, manual)
    merged.splice(0, merged.length, ...withoutDuplicate)
  }
  return normalizeVideoOrder(merged)
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const service = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
  const authHeader = request.headers.get("Authorization")
  if (!authHeader) return json({ error: "Authentication required" }, 401)

  const userClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: "Authentication required" }, 401)

  const { data: admin } = await service
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return json({ error: "A JSON body is required" }, 400)
  }

  const action = body.action
  if (action === "session") {
    return json({
      is_admin: Boolean(admin),
      is_anonymous: user.is_anonymous ?? false,
      email: user.email ?? null,
    })
  }
  if (!admin) return json({ error: "Admin access required" }, 403)

  try {
    if (action === "search") {
      const query = typeof body.query === "string" ? body.query.trim() : ""
      const escaped = query.replace(/[%_]/g, (character) => `\\${character}`)
      const { data, error } = await service
        .from("artists")
        .select("id,name,is_curated,last_refreshed_at")
        .ilike("name", `%${escaped}%`)
        .order("name")
        .limit(20)
      if (error) throw error
      return json({ artists: data ?? [] })
    }

    if (action === "preview") {
      const artistId = typeof body.artist_id === "string" ? body.artist_id : ""
      const scopes = Array.isArray(body.scopes)
        ? body.scopes.filter((scope): scope is RefreshScope =>
          scope === "metadata" || scope === "same_vibe" || scope === "videos"
        )
        : []
      if (!artistId || scopes.length === 0) {
        return json({ error: "An artist and at least one scope are required" }, 400)
      }

      const { data: before, error: snapshotError } = await service.rpc(
        "current_artist_content_snapshot",
        { p_artist_id: artistId },
      )
      if (snapshotError || !before) throw snapshotError ?? new Error("Artist not found")
      const snapshot = before as Snapshot
      const proposedArtist = structuredClone(snapshot.artist)
      let proposedVideos = snapshot.videos

      if (scopes.includes("videos")) {
        const generated = await generateVideos(
          snapshot.artist.name,
          Deno.env.get("YOUTUBE_API_KEY")!,
        )
        proposedVideos = mergeManualVideos(generated, snapshot.videos)
      }

      if (scopes.includes("metadata") || scopes.includes("same_vibe")) {
        const wiki = await fetchWikipedia(snapshot.artist.name)
        const context = await generateContext(
          snapshot.artist.name,
          proposedVideos.map((video) => video.title),
          wiki?.extract ?? null,
          Deno.env.get("ANTHROPIC_API_KEY")!,
        )
        if (scopes.includes("metadata") && (
          context.tags.length === 0
          || !context.blurb
          || !context.artist_context.sceneSummary
        )) {
          throw new Error("Generated metadata was incomplete; no preview was saved")
        }
        if (scopes.includes("same_vibe") && context.related_artists.length === 0) {
          throw new Error("Generated same-vibe artists were empty; no preview was saved")
        }

        if (scopes.includes("metadata")) {
          proposedArtist.tags = context.tags
          proposedArtist.tag_source = "llm"
          proposedArtist.blurb = context.blurb
          if (wiki) {
            proposedArtist.wikipedia_extract = wiki.extract
            proposedArtist.wikipedia_thumbnail_url = wiki.thumbnailUrl
            proposedArtist.wikipedia_url = wiki.pageUrl
          }
          proposedArtist.artist_context = {
            ...context.artist_context,
            relatedArtists:
              snapshot.artist.artist_context?.relatedArtists
              ?? [],
          }
        }

        if (scopes.includes("same_vibe")) {
          proposedArtist.related_artists = context.related_artists
          proposedArtist.artist_context = {
            ...(proposedArtist.artist_context ?? context.artist_context),
            relatedArtists: context.artist_context.relatedArtists,
          }
        }
      }

      const proposed: Snapshot = {
        artist: proposedArtist,
        videos: proposedVideos,
      }
      const { data: refresh, error } = await service
        .from("admin_content_refreshes")
        .insert({
          artist_id: artistId,
          requested_by: user.id,
          scopes,
          before_snapshot: snapshot,
          proposed_snapshot: proposed,
        })
        .select("*")
        .single()
      if (error) throw error
      return json({ refresh })
    }

    if (action === "replace_video") {
      const videoId = parseYouTubeVideoId(
        typeof body.youtube_url === "string" ? body.youtube_url : "",
      )
      if (!videoId) return json({ error: "Enter a valid YouTube URL" }, 400)
      const details = await youtubeVideoDetails(
        [videoId],
        Deno.env.get("YOUTUBE_API_KEY")!,
      )
      const detail = details.get(videoId)
      if (!detail) return json({ error: "That YouTube video is unavailable" }, 400)
      const video: RefreshVideo = {
        youtube_video_id: videoId,
        title: detail.title,
        description: detail.description,
        thumbnail_url: detail.thumbnail,
        published_at: detail.publishedAt,
        view_count: detail.viewCount,
        duration: detail.duration,
        search_query: "admin replacement",
        is_manually_added: true,
        display_order: 0,
        video_type: "concert",
        channel_title: detail.channelTitle,
      }
      return json({ video })
    }

    if (action === "publish") {
      const refreshId = typeof body.refresh_id === "string" ? body.refresh_id : ""
      const submittedVideos = Array.isArray(body.proposed_videos)
        ? body.proposed_videos as RefreshVideo[]
        : []
      const manualVideoReplacements = Array.isArray(body.manual_video_replacements)
        ? body.manual_video_replacements.filter(
          (id): id is string => typeof id === "string",
        )
        : []
      const submittedArtist = body.proposed_artist && typeof body.proposed_artist === "object"
        ? body.proposed_artist as ArtistRow
        : null
      const { data: refresh, error: refreshError } = await service
        .from("admin_content_refreshes")
        .select("*")
        .eq("id", refreshId)
        .eq("requested_by", user.id)
        .eq("status", "preview")
        .single()
      if (refreshError) throw refreshError
      const before = refresh.before_snapshot as Snapshot
      const storedProposed = refresh.proposed_snapshot as Snapshot
      const protectedReplacementPositions = concertVideos(before.videos)
        .filter((video) =>
          video.is_manually_added
          && manualVideoReplacements.includes(video.youtube_video_id)
        )
        .map((video) => video.display_order)
      const proposedVideos = normalizeVideoOrder(
        submittedVideos,
        protectedReplacementPositions,
      )
      const editedArtist = submittedArtist
        ? applyManualArtistEdits(
          storedProposed.artist,
          submittedArtist,
          refresh.scopes as RefreshScope[],
        )
        : {
          artist: storedProposed.artist,
          manualMetadataEdit: false,
          errors: [],
        }
      const errors = validatePublishRequest({
        scopes: refresh.scopes as RefreshScope[],
        isCurated: before.artist.is_curated,
        existingVideos: concertVideos(before.videos),
        proposedVideos,
        manualVideoReplacements,
      })
      errors.push(...editedArtist.errors)
      if (errors.length > 0) return json({ error: errors.join(" ") }, 400)

      const { error: updateError } = await service
        .from("admin_content_refreshes")
        .update({
          proposed_snapshot: {
            ...storedProposed,
            artist: editedArtist.artist,
            videos: proposedVideos,
            manual_video_replacements: manualVideoReplacements,
            manual_metadata_edit: editedArtist.manualMetadataEdit,
          },
        })
        .eq("id", refreshId)
        .eq("status", "preview")
      if (updateError) throw updateError

      const { data: published, error: publishError } = await service.rpc(
        "publish_admin_content_refresh",
        { p_refresh_id: refreshId },
      )
      if (publishError) {
        const conflict = publishError.message.includes("changed after")
        await service
          .from("admin_content_refreshes")
          .update({
            status: conflict ? "conflict" : "failed",
            error_message: publishError.message,
          })
          .eq("id", refreshId)
          .eq("status", "preview")
        throw publishError
      }
      return json({ published })
    }

    return json({ error: "Unknown action" }, 400)
  } catch (error) {
    console.error("admin-content-refresh error:", error)
    return json({ error: errorMessage(error) }, 500)
  }
})
