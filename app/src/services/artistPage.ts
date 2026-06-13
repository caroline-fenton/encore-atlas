import { supabase } from "./supabase"

export type ArtistContext = {
  genre: string[]
  city: string | null
  yearsActive: string | null
  knownFor: string[]
  associatedWith: string[]
  sceneSummary: string
  relatedArtists: Array<{ name: string; reason: string }>
}

export type ArtistVideo = {
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

export type ArtistPageData = {
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
  videos: ArtistVideo[]
  interview_videos: ArtistVideo[]
  music_videos: ArtistVideo[]
  interviews_synced: boolean
  music_videos_synced: boolean
  was_cache_hit: boolean
}

/**
 * Checks if an artist page is already cached in Supabase.
 * Returns the data if the artist has been through the build pipeline
 * (last_refreshed_at is set), even if Claude tagging failed.
 */
export async function getCachedArtistPage(
  artistName: string,
): Promise<ArtistPageData | null> {
  const normalized = artistName.trim().toLowerCase()
  const escaped = normalized.replace(/%/g, "\\%").replace(/_/g, "\\_")

  const { data: artist } = await supabase
    .from("artists")
    .select("*")
    .ilike("name", escaped)
    .maybeSingle()

  // last_refreshed_at is set by the edge function after a successful build.
  // Using this instead of tags avoids perpetual rebuilds when tagging fails.
  if (!artist || !artist.last_refreshed_at) {
    return null
  }

  const { data: allVideos, error: videosError } = await supabase
    .from("artist_videos")
    .select("*")
    .eq("artist_id", artist.id)
    .order("display_order", { ascending: true })

  // A failed query is not the same as "no videos" — don't treat it as a
  // completed-but-empty cache entry, which would suppress live fallbacks.
  if (videosError) {
    return null
  }

  const toArtistVideo = (v: Record<string, unknown>): ArtistVideo => ({
    id: v.id as string,
    youtube_video_id: v.youtube_video_id as string,
    title: v.title as string,
    description: v.description as string | null,
    thumbnail_url: v.thumbnail_url as string | null,
    published_at: v.published_at as string | null,
    view_count: v.view_count as number | null,
    duration: v.duration as string | null,
    display_order: v.display_order as number,
    channel_title: v.channel_title as string | null,
  })

  const byType = (type: string) =>
    (allVideos ?? []).filter((v) => (v.video_type ?? "concert") === type).map(toArtistVideo)

  const syncedTypes: string[] = artist.video_types_synced ?? []

  return {
    artist: {
      id: artist.id,
      name: artist.name,
      tags: artist.tags,
      blurb: artist.blurb,
      bio: artist.bio,
      bio_image_url: artist.wikipedia_thumbnail_url,
      decade: artist.decade,
      related_artists: artist.related_artists,
      is_curated: artist.is_curated,
      artist_context: (artist.artist_context as ArtistContext) ?? null,
    },
    videos: byType("concert"),
    interview_videos: byType("interview"),
    music_videos: byType("music_video"),
    interviews_synced: syncedTypes.includes("interview"),
    music_videos_synced: syncedTypes.includes("music_video"),
    was_cache_hit: true,
  }
}

/**
 * Calls the Supabase Edge Function to build an artist page.
 * The edge function handles YouTube search + Claude tagging + DB write.
 */
export async function buildArtistPage(
  artistName: string,
): Promise<ArtistPageData> {
  const { data, error } = await supabase.functions.invoke("build-artist-page", {
    body: { artist_name: artistName },
  })

  if (error) {
    throw new Error(`Failed to build artist page: ${error.message}`)
  }

  return data as ArtistPageData
}

/**
 * Fetches an artist page — from cache if available, otherwise builds it
 * via the edge function. Returns the page data and whether it was a cache hit.
 */
export async function fetchArtistPage(
  artistName: string,
): Promise<ArtistPageData> {
  // Try cache first (fast path — no edge function call needed)
  const cached = await getCachedArtistPage(artistName)
  if (cached) return cached

  // Cache miss — call the edge function to build the page
  return buildArtistPage(artistName)
}
