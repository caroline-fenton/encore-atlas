import { supabase } from "./supabase"
import type { Database } from "../types/supabase"

type WatchHistoryRow = Database["public"]["Tables"]["watch_history"]["Row"]

export type WatchHistoryEntry = WatchHistoryRow & {
  artists: { name: string } | null
}

/**
 * Records a video watch in the watch_history table.
 * Returns true if the row was successfully persisted, false otherwise.
 * Errors are caught and logged so callers can fall through without try/catch,
 * but the boolean return lets them avoid updating local state on failure.
 */
export async function recordWatch(
  userId: string,
  artistId: string,
  youtubeVideoId: string,
  videoTitle: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("watch_history").insert([
      {
        user_id: userId,
        artist_id: artistId,
        youtube_video_id: youtubeVideoId,
        video_title: videoTitle,
      },
    ])

    if (error) {
      console.warn("[watchHistory] recordWatch error:", error.message)
      return false
    }

    return true
  } catch (err) {
    console.warn("[watchHistory] recordWatch error:", err)
    return false
  }
}

/**
 * Returns the set of youtube_video_ids the user has watched for a given artist.
 */
export async function getWatchedVideoIds(
  userId: string,
  artistId: string,
): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("watch_history")
      .select("youtube_video_id")
      .eq("user_id", userId)
      .eq("artist_id", artistId)

    if (error) {
      console.warn("[watchHistory] getWatchedVideoIds error:", error.message)
      return new Set()
    }

    return new Set(data?.map((r) => r.youtube_video_id) ?? [])
  } catch (err) {
    console.warn("[watchHistory] getWatchedVideoIds error:", err)
    return new Set()
  }
}

/**
 * Fetches a user's recent watch history, joined with artist names.
 */
export async function getRecentWatchHistory(
  userId: string,
  limit = 50,
): Promise<WatchHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from("watch_history")
      .select("*, artists(name)")
      .eq("user_id", userId)
      .order("watched_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.warn("[watchHistory] getRecentWatchHistory error:", error.message)
      return []
    }

    return (data ?? []) as WatchHistoryEntry[]
  } catch (err) {
    console.warn("[watchHistory] getRecentWatchHistory error:", err)
    return []
  }
}
