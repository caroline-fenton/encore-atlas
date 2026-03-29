import { useState, useEffect, useCallback } from "react"
import type { User } from "@supabase/supabase-js"
import { findOrCreateArtist } from "../services/artists"
import {
  recordSearch as recordSearchService,
  getRecentSearches,
} from "../services/searchHistory"
import type { Database } from "../types/supabase"

type ArtistSearchRow = Database["public"]["Tables"]["artist_searches"]["Row"]

/**
 * React hook that syncs search history to Supabase.
 * Falls back gracefully if Supabase is unavailable.
 * Accepts the current user and a `waitForAuth` helper so that searches
 * submitted before auth init completes are not silently dropped.
 */
export function useSupabaseSearches(
  user: User | null,
  waitForAuth: () => Promise<User | null>,
) {
  const [recentSearches, setRecentSearches] = useState<ArtistSearchRow[]>([])

  // Fetch recent searches on mount (and when user changes)
  useEffect(() => {
    if (!user) return

    let cancelled = false

    getRecentSearches(user.id).then((rows) => {
      if (!cancelled) {
        setRecentSearches(rows)
      }
    })

    return () => {
      cancelled = true
    }
  }, [user])

  /**
   * Records a search to Supabase.
   * Finds or creates the artist, then inserts the search row.
   * Fire-and-forget — errors are caught and logged.
   *
   * If auth has not initialised yet, waits for it rather than
   * silently dropping the search.
   */
  const recordSearch = useCallback(
    async (artistName: string): Promise<void> => {
      // If user is not available yet, wait for auth to finish initialising.
      const resolvedUser = user ?? (await waitForAuth())
      if (!resolvedUser) return

      try {
        const artist = await findOrCreateArtist(artistName)
        await recordSearchService(
          resolvedUser.id,
          artistName,
          artist?.id ?? undefined,
        )

        // Optimistically refresh the list
        getRecentSearches(resolvedUser.id)
          .then(setRecentSearches)
          .catch(() => {})
      } catch (err) {
        console.warn("[useSupabaseSearches] recordSearch failed:", err)
      }
    },
    [user, waitForAuth],
  )

  return { recentSearches, recordSearch }
}
