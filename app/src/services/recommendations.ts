import { supabase } from "./supabase"
import type { Database } from "../types/supabase"

export type Recommendation =
  Database["public"]["Functions"]["get_recommendations"]["Returns"][number]

/**
 * Fetches artist recommendations for the current session user via the
 * two-layer scoring function:
 *   Layer 1 — tag similarity (shared genre tags × 10 per watched artist)
 *   Layer 2 — bio-derived scene adjacency (geography, era, influence signals)
 *
 * The DB function uses auth.uid() internally — no user ID is passed from the
 * client, so callers cannot query another user's recommendations.
 *
 * Returns an empty array if the user has no watch history or the RPC fails.
 */
export async function getRecommendations(
  limit = 10,
): Promise<Recommendation[]> {
  try {
    const { data, error } = await supabase.rpc("get_recommendations", {
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
