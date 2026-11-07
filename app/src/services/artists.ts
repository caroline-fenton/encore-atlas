import { supabase } from "./supabase"
import type { Database } from "../types/supabase"

type ArtistRow = Database["public"]["Tables"]["artists"]["Row"]

/**
 * Resolves spelling variants through the same database lookup as the builder.
 * Returns the artist row or null.
 */
export async function getArtistByName(
  name: string,
): Promise<ArtistRow | null> {
  try {
    const { data, error } = await supabase
      .rpc("resolve_artist", { p_name: name })
      .maybeSingle()

    if (error) {
      console.warn("[artists] getArtistByName error:", error.message)
      return null
    }

    return data
  } catch (err) {
    console.warn("[artists] getArtistByName error:", err)
    return null
  }
}
