import { supabase } from "./supabase"

export type ArtistPageData = {
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

/**
 * Checks if an artist page is already cached in Supabase.
 * Returns the data if the artist has been through the build pipeline
 * (last_refreshed_at is set), even if Claude tagging failed.
 */
async function getCachedArtistPage(
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

  const { data: videos } = await supabase
    .from("artist_videos")
    .select("*")
    .eq("artist_id", artist.id)
    .order("display_order", { ascending: true })

  return {
    artist: {
      id: artist.id,
      name: artist.name,
      tags: artist.tags,
      blurb: artist.blurb,
      decade: artist.decade,
      related_artists: artist.related_artists,
      is_curated: artist.is_curated,
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
}

/**
 * Calls the Supabase Edge Function to build an artist page.
 * The edge function handles YouTube search + Claude tagging + DB write.
 */
async function buildArtistPage(
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
