import { supabase } from "./supabase"
import type { ArtistContext } from "./artistPage"

export type RefreshScope = "metadata" | "same_vibe" | "videos"

export type AdminArtist = {
  id: string
  name: string
  is_curated: boolean
  last_refreshed_at: string | null
}

export type RefreshVideo = {
  youtube_video_id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  published_at: string | null
  view_count: number | null
  duration: string | null
  search_query: string
  is_manually_added: boolean
  display_order: number
  video_type: string
  channel_title: string | null
}

export type RefreshArtist = AdminArtist & {
  tags: string[] | null
  tag_source: string | null
  blurb: string | null
  decade: string | null
  related_artists: string[] | null
  artist_context: ArtistContext | null
  wikipedia_extract: string | null
  wikipedia_thumbnail_url: string | null
  wikipedia_url: string | null
}

export type RefreshSnapshot = {
  artist: RefreshArtist
  videos: RefreshVideo[]
  manual_video_removals?: string[]
  manual_video_replacements?: string[]
}

export type ContentRefresh = {
  id: string
  artist_id: string
  scopes: RefreshScope[]
  status: "preview" | "published" | "failed" | "conflict"
  before_snapshot: RefreshSnapshot
  proposed_snapshot: RefreshSnapshot
  created_at: string
}

type AdminSession = {
  is_admin: boolean
  is_anonymous: boolean
  email: string | null
}

async function invoke<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "admin-content-refresh",
    { body: { action, ...payload } },
  )
  if (error) {
    let message = error.message
    try {
      const body = await error.context?.json()
      if (body?.error) message = body.error
    } catch {
      // Keep the function client's message when the response is not JSON.
    }
    throw new Error(message)
  }
  return data as T
}

export function getAdminSession(): Promise<AdminSession> {
  return invoke<AdminSession>("session")
}

export async function searchAdminArtists(query: string): Promise<AdminArtist[]> {
  const data = await invoke<{ artists: AdminArtist[] }>("search", { query })
  return data.artists
}

export async function generateRefreshPreview(
  artistId: string,
  scopes: RefreshScope[],
): Promise<ContentRefresh> {
  const data = await invoke<{ refresh: ContentRefresh }>("preview", {
    artist_id: artistId,
    scopes,
  })
  return data.refresh
}

export async function previewReplacementVideo(
  youtubeUrl: string,
): Promise<RefreshVideo> {
  const data = await invoke<{ video: RefreshVideo }>("replace_video", {
    youtube_url: youtubeUrl,
  })
  return data.video
}

export async function publishContentRefresh(
  refreshId: string,
  artist: RefreshArtist,
  videos: RefreshVideo[],
  manualVideoReplacements: string[],
  manualVideoRemovals: string[],
): Promise<void> {
  await invoke("publish", {
    refresh_id: refreshId,
    proposed_artist: artist,
    proposed_videos: videos,
    manual_video_replacements: manualVideoReplacements,
    manual_video_removals: manualVideoRemovals,
  })
}

export async function sendAdminMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/admin/content-refresh`,
    },
  })
  if (error) throw error
}

export async function signOutAdmin(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
