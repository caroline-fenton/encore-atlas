import { supabase } from "./supabase"
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js"

/**
 * Upserts the user row in public.users after sign-in.
 * Fire-and-forget — errors are logged but never thrown.
 */
async function upsertUserRow(user: User): Promise<void> {
  try {
    // Try insert first (new user)
    const { error: insertError } = await supabase.from("users").insert(
      {
        id: user.id,
        is_anonymous: user.is_anonymous ?? true,
        last_seen_at: new Date().toISOString(),
      },
      { defaultToNull: false },
    )

    if (insertError) {
      // If user already exists (duplicate key), update last_seen_at instead
      if (insertError.code === "23505") {
        await supabase
          .from("users")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", user.id)
      } else {
        console.warn("[auth] Failed to insert user row:", insertError.message)
      }
    }
  } catch (err) {
    console.warn("[auth] Failed to upsert user row:", err)
  }
}

/**
 * Ensures a Supabase session exists.
 * If the user already has a session it is reused;
 * otherwise an anonymous sign-in is performed.
 * Returns the authenticated User.
 */
export async function ensureSession(): Promise<User | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) {
      // Await upsert so the users row exists before callers record searches
      await upsertUserRow(session.user)
      return session.user
    }

    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.warn("[auth] Anonymous sign-in failed:", error.message)
      return null
    }

    if (data.user) {
      await upsertUserRow(data.user)
    }

    return data.user ?? null
  } catch (err) {
    console.warn("[auth] ensureSession error:", err)
    return null
  }
}

/**
 * Returns the current user or null if no session exists.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

/**
 * Subscribes to auth state changes.
 * Returns the unsubscribe function.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback)
  return subscription.unsubscribe.bind(subscription)
}
