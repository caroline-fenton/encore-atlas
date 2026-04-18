import { supabase } from "./supabase"
import type { Database } from "../types/supabase"

type ArtistSearchRow = Database["public"]["Tables"]["artist_searches"]["Row"]

/**
 * Records a search in the artist_searches table.
 * This supplements localStorage — it does not replace it.
 */
export async function recordSearch(
  userId: string,
  queryText: string,
  artistId?: string,
  wasCacheHit?: boolean,
): Promise<void> {
  try {
    const { error } = await supabase.from("artist_searches").insert(
      [
        {
          user_id: userId,
          query_text: queryText,
          selected_artist_id: artistId ?? null,
          was_cache_hit: wasCacheHit ?? false,
        },
      ],
      { defaultToNull: false },
    )

    if (error) {
      console.warn("[searchHistory] recordSearch error:", error.message)
    }
  } catch (err) {
    console.warn("[searchHistory] recordSearch error:", err)
  }
}

/**
 * Fetches recent searches for a user, ordered by searched_at descending.
 */
export async function getRecentSearches(
  userId: string,
  limit = 20,
): Promise<ArtistSearchRow[]> {
  try {
    const { data, error } = await supabase
      .from("artist_searches")
      .select("*")
      .eq("user_id", userId)
      .order("searched_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.warn("[searchHistory] getRecentSearches error:", error.message)
      return []
    }

    return data ?? []
  } catch (err) {
    console.warn("[searchHistory] getRecentSearches error:", err)
    return []
  }
}
