import { useState, useEffect } from "react"
import type { User } from "@supabase/supabase-js"
import { ensureSession, onAuthStateChange } from "../services/auth"

type AuthState = {
  user: User | null
  loading: boolean
  isAnonymous: boolean
}

/**
 * React hook that manages anonymous authentication.
 * On mount it ensures a Supabase session exists and
 * listens for subsequent auth state changes.
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Bootstrap session
    ensureSession().then((u) => {
      if (mounted) {
        setUser(u)
        setLoading(false)
      }
    })

    // Listen for changes (e.g. token refresh)
    const unsubscribe = onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  return {
    user,
    loading,
    isAnonymous: user?.is_anonymous ?? true,
  }
}
