import { supabase } from "./supabase"
import type { Database } from "../types/supabase"

export type Recommendation =
  Database["public"]["Functions"]["get_recommendations"]["Returns"][number]

/**
 * Fetches artist recommendations for a user via the two-layer scoring function:
 *   Layer 1 — tag similarity (shared genre tags × 10 per watched artist)
 *   Layer 2 — bio-derived scene adjacency (geography, era, influence signals)
 *
 * Returns an empty array if the user has no watch history or the RPC fails.
 */
export async function getRecommendations(
  userId: string,
  limit = 10,
): Promise<Recommendation[]> {
  try {
    const { data, error } = await supabase.rpc("get_recommendations", {
      p_user_id: userId,
      p_limit: limit,
    })

    if (error) {
      console.warn("[recommendations] getRecommendations error:", error.message)
      return []
    }

    return data ?? []
  } catch (err) {
    console.warn("[recommendations] getRecommendations error:", err)
    return []
  }
}
