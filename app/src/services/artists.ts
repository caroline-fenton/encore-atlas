import { supabase } from "./supabase"
import type { Database } from "../types/supabase"

type ArtistRow = Database["public"]["Tables"]["artists"]["Row"]

/**
 * Looks up an artist by name (case-insensitive).
 * Returns the artist row or null.
 */
export async function getArtistByName(
  name: string,
): Promise<ArtistRow | null> {
  try {
    // Use lower() for a case-insensitive exact match instead of ilike,
    // which would treat '%' and '_' in the name as SQL wildcards.
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .filter("name", "ilike", name.replace(/%/g, "\\%").replace(/_/g, "\\_"))
      .limit(1)
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

/**
 * Finds an existing artist by name (case-insensitive) or creates a new one.
 * Returns the artist row, or null if both lookup and insert fail.
 */
export async function findOrCreateArtist(
  name: string,
): Promise<ArtistRow | null> {
  try {
    // Try to find existing artist first
    const existing = await getArtistByName(name)
    if (existing) return existing

    // Not found — insert with normalized (lowercase) name for deduplication
    const normalizedName = name.trim().toLowerCase()
    const { data, error } = await supabase
      .from("artists")
      .insert({ name: normalizedName }, { defaultToNull: false })
      .select()
      .single()

    if (error) {
      // Handle race condition: another request may have inserted between
      // our SELECT and INSERT.  Re-fetch to be safe.
      if (error.code === "23505") {
        return getArtistByName(name)
      }
      console.warn("[artists] findOrCreateArtist insert error:", error.message)
      return null
    }

    return data
  } catch (err) {
    console.warn("[artists] findOrCreateArtist error:", err)
    return null
  }
}
