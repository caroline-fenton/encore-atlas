import { useState, useEffect, useRef, useCallback } from "react"
import type { User } from "@supabase/supabase-js"
import { ensureSession, onAuthStateChange } from "../services/auth"

type AuthState = {
  user: User | null
  loading: boolean
  isAnonymous: boolean
  /** Returns a promise that resolves with the user once auth init completes. */
  waitForAuth: () => Promise<User | null>
}

/**
 * React hook that manages anonymous authentication.
 * On mount it ensures a Supabase session exists and
 * listens for subsequent auth state changes.
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // A ref holding a promise that resolves once the initial auth bootstrap
  // is complete.  Callers can await this to avoid racing against init.
  const readyRef = useRef<{
    promise: Promise<User | null>
    resolve: (u: User | null) => void
  } | null>(null)

  if (readyRef.current === null) {
    let resolve: (u: User | null) => void = () => {}
    const promise = new Promise<User | null>((r) => {
      resolve = r
    })
    readyRef.current = { promise, resolve }
  }

  useEffect(() => {
    let mounted = true

    // Bootstrap session
    ensureSession().then((u) => {
      if (mounted) {
        setUser(u)
        setLoading(false)
      }
      // Always resolve so waiters unblock even if unmounted
      readyRef.current?.resolve(u)
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

  const waitForAuth = useCallback(
    () => readyRef.current!.promise,
    [],
  )

  return {
    user,
    loading,
    isAnonymous: user?.is_anonymous ?? true,
    waitForAuth,
  }
}
