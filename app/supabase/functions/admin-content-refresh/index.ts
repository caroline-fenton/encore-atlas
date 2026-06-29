import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0"
import {
  applyManualArtistEdits,
  editableVideos,
  mergeTargetedRefreshVideos,
  normalizeEditableVideoOrder,
  parseYouTubeVideoId,
  validatePublishRequest,
  type RefreshScope,
  type RefreshVideo,
} from "../_shared/refresh-policy.ts"
import { getAliases } from "../../../src/data/artistAliases.ts"
import { decodeHtml } from "../../../src/utils/decodeHtml.ts"

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
  manual_video_removals?: string[]
  manual_video_replacements?: string[]
  video_search_queries?: VideoSearchQueries
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

type YouTubeSearchItem = {
  id: { videoId: string }
  snippet: {
    title: string
    description: string | null
    publishedAt: string | null
    channelTitle: string | null
  }
}

type VideoSearchQueries = Partial<Record<"concert" | "interview" | "music_video", string>>

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

async function youtubeSearch(
  query: string,
  apiKey: string,
  maxResults = 25,
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

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "")
}

function matchesArtistName(text: string, textNorm: string, name: string): boolean {
  const stripped = name.replace(/^the\s+/, "")
  const strippedNorm = normalizeForMatch(stripped)
  const nameNorm = normalizeForMatch(name)

  return (
    text.includes(stripped)
    || text.includes(name)
    || (strippedNorm !== "" && textNorm.includes(strippedNorm))
    || (nameNorm !== "" && textNorm.includes(nameNorm))
  )
}

function isRelevantResult(item: YouTubeSearchItem, artistName: string): boolean {
  const title = decodeHtml(item.snippet.title).toLowerCase()
  const titleNorm = normalizeForMatch(title)
  const channel = decodeHtml(item.snippet.channelTitle ?? "").toLowerCase()
  const channelNorm = normalizeForMatch(channel)
  const names = [
    artistName.toLowerCase(),
    ...getAliases(artistName).map((alias) => alias.toLowerCase()),
  ]

  return names.some((name) =>
    matchesArtistName(title, titleNorm, name)
    || matchesArtistName(channel, channelNorm, name)
  )
}

function defaultVideoSearchQueries(artistName: string): Required<VideoSearchQueries> {
  return {
    concert: `${artistName} live concert full set`,
    interview: `${artistName} interview`,
    music_video: `${artistName} official music video`,
  }
}

function parseVideoSearchQueries(value: unknown): VideoSearchQueries | null {
  if (!value || typeof value !== "object") return null
  const input = value as Record<string, unknown>
  const queries: VideoSearchQueries = {}
  for (const type of ["concert", "interview", "music_video"] as const) {
    const query = typeof input[type] === "string" ? input[type].trim() : ""
    if (query) queries[type] = query
  }
  return Object.keys(queries).length > 0 ? queries : null
}

async function targetedVideoPreview(
  artistName: string,
  queries: VideoSearchQueries,
  existingVideos: RefreshVideo[],
  apiKey: string,
): Promise<RefreshVideo[]> {
  const generated: RefreshVideo[] = []
  const refreshedTypes: Array<"concert" | "interview" | "music_video"> = []

  for (const type of ["concert", "interview", "music_video"] as const) {
    const query = queries[type]
    if (!query) continue
    refreshedTypes.push(type)

    const searchResults = (await youtubeSearch(query, apiKey, 25))
      .filter((item) => isRelevantResult(item, artistName))
    const details = await youtubeVideoDetails(
      searchResults.map((item) => item.id.videoId),
      apiKey,
    )

    generated.push(
      ...searchResults.map((item, index) => {
        const detail = details.get(item.id.videoId)
        return {
          youtube_video_id: item.id.videoId,
          title: item.snippet.title,
          description: detail?.description ?? item.snippet.description ?? null,
          thumbnail_url: detail?.thumbnail ?? null,
          published_at: detail?.publishedAt ?? item.snippet.publishedAt ?? null,
          view_count: detail?.viewCount ?? null,
          duration: detail?.duration ?? null,
          search_query: query,
          is_manually_added: false,
          display_order: index,
          video_type: type,
          channel_title: detail?.channelTitle ?? item.snippet.channelTitle ?? null,
        }
      }),
    )
  }

  return normalizeEditableVideoOrder(
    mergeTargetedRefreshVideos(
      generated,
      editableVideos(existingVideos),
      refreshedTypes,
    ),
  )
}

function editableArtistSnapshot(artist: ArtistRow): ArtistRow {
  const context: ArtistContext = {
    genre: artist.artist_context?.genre ?? artist.tags ?? [],
    city: artist.artist_context?.city ?? null,
    yearsActive: artist.artist_context?.yearsActive ?? null,
    knownFor: artist.artist_context?.knownFor ?? [],
    associatedWith: artist.artist_context?.associatedWith ?? [],
    sceneSummary: artist.artist_context?.sceneSummary ?? artist.blurb ?? "",
    relatedArtists:
      artist.artist_context?.relatedArtists
      ?? artist.related_artists?.map((name) => ({ name, reason: "" }))
      ?? [],
  }

  return {
    ...artist,
    artist_context: context,
  }
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
      const requestedVideoSearchQueries = parseVideoSearchQueries(
        body.video_search_queries,
      )

      const { data: before, error: snapshotError } = await service.rpc(
        "current_artist_content_snapshot",
        { p_artist_id: artistId },
      )
      if (snapshotError || !before) throw snapshotError ?? new Error("Artist not found")
      const snapshot = before as Snapshot
      const proposedArtist = structuredClone(snapshot.artist)
      let proposedVideos = snapshot.videos

      if (scopes.includes("videos")) {
        proposedVideos = requestedVideoSearchQueries
          ? await targetedVideoPreview(
            snapshot.artist.name,
            requestedVideoSearchQueries,
            snapshot.videos,
            Deno.env.get("YOUTUBE_API_KEY")!,
          )
          : editableVideos(snapshot.videos)
      }

      if (scopes.includes("metadata") || scopes.includes("same_vibe")) {
        Object.assign(proposedArtist, editableArtistSnapshot(snapshot.artist))
      }

      const proposed: Snapshot = {
        artist: proposedArtist,
        videos: proposedVideos,
      }
      if (requestedVideoSearchQueries) {
        proposed.video_search_queries = {
          ...defaultVideoSearchQueries(snapshot.artist.name),
          ...requestedVideoSearchQueries,
        }
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
      const requestedVideoType = typeof body.video_type === "string"
        && ["concert", "interview", "music_video"].includes(body.video_type)
        ? body.video_type
        : "concert"
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
        video_type: requestedVideoType,
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
      const manualVideoRemovals = Array.isArray(body.manual_video_removals)
        ? body.manual_video_removals.filter(
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
      const protectedReplacementPositionsByType = editableVideos(before.videos)
        .filter((video) =>
          video.is_manually_added
          && manualVideoReplacements.includes(`${video.video_type ?? "concert"}:${video.youtube_video_id}`)
        )
        .reduce<Record<string, number[]>>((positions, video) => {
          const type = video.video_type ?? "concert"
          positions[type] = [...(positions[type] ?? []), video.display_order]
          return positions
        }, {})
      const proposedVideos = normalizeEditableVideoOrder(
        submittedVideos,
        protectedReplacementPositionsByType,
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
        existingVideos: editableVideos(before.videos),
        proposedVideos,
        manualVideoRemovals,
        manualVideoReplacements,
        manualMetadataEdit: editedArtist.manualMetadataEdit,
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
            manual_video_removals: manualVideoRemovals,
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
