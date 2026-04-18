import { useState, useEffect, useCallback } from "react"
import { useAuth } from "./useAuth"
import { findOrCreateArtist } from "../services/artists"
import {
  recordWatch as recordWatchService,
  getWatchedVideoIds,
} from "../services/watchHistory"
import type { Video } from "../types/video"

/**
 * Tracks watch history for the current artist.
 *
 * - watchedVideoIds: set of youtube_video_ids the user has already watched
 *   for the given artist (empty if artistId is null or user not authed yet).
 * - recordWatch: fire-and-forget function to record a video watch.
 */
export function useWatchHistory(artistId: string | null) {
  const { user, waitForAuth } = useAuth()
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

        await recordWatchService(
          resolvedUser.id,
          artist.id,
          video.id,
          video.title,
        )

        // Optimistically mark as watched without waiting for a re-fetch
        setWatchedVideoIds((prev) => new Set([...prev, video.id]))
      } catch (err) {
        console.warn("[useWatchHistory] recordWatch failed:", err)
      }
    },
    [user, waitForAuth],
  )

  return { watchedVideoIds, recordWatch }
}
