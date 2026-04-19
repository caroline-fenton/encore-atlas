import { useState, useEffect, useCallback } from "react"
import type { User } from "@supabase/supabase-js"
import { findOrCreateArtist } from "../services/artists"
import {
  recordWatch as recordWatchService,
  getWatchedVideoIds,
} from "../services/watchHistory"
import type { Video } from "../types/video"

/**
 * Tracks watch history for the current artist.
 *
 * Accepts user/waitForAuth from a single auth owner (AppLayout via
 * outlet context) rather than calling useAuth() itself, to avoid
 * parallel ensureSession() bootstraps racing into split user_ids.
 *
 * - watchedVideoIds: set of youtube_video_ids the user has already watched
 *   for the given artist (empty if artistId is null or user not authed yet).
 * - recordWatch: records a video watch; local state only updates on success.
 */
export function useWatchHistory(
  artistId: string | null,
  user: User | null,
  waitForAuth: () => Promise<User | null>,
) {
  const [watchedVideoIds, setWatchedVideoIds] = useState<Set<string>>(new Set())

  // Refresh watched IDs whenever the artist or user changes
  useEffect(() => {
    if (!user || !artistId) {
      setWatchedVideoIds(new Set())
      return
    }

    let cancelled = false
    getWatchedVideoIds(user.id, artistId).then((ids) => {
      if (!cancelled) setWatchedVideoIds(ids)
    })

    return () => {
      cancelled = true
    }
  }, [user, artistId])

  const recordWatch = useCallback(
    async (video: Video, artistName: string): Promise<void> => {
      const resolvedUser = user ?? (await waitForAuth())
      if (!resolvedUser) return

      try {
        const artist = await findOrCreateArtist(artistName)
        if (!artist) return

        const ok = await recordWatchService(
          resolvedUser.id,
          artist.id,
          video.id,
          video.title,
        )

        // Only mark as watched after the row is actually persisted.
        // Otherwise the badge and /history page diverge on refresh.
        if (ok) {
          setWatchedVideoIds((prev) => new Set([...prev, video.id]))
        }
      } catch (err) {
        console.warn("[useWatchHistory] recordWatch failed:", err)
      }
    },
    [user, waitForAuth],
  )

  return { watchedVideoIds, recordWatch }
}
