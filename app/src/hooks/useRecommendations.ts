import { useState, useEffect } from "react"
import type { User } from "@supabase/supabase-js"
import {
  getRecommendations,
  type Recommendation,
} from "../services/recommendations"

/**
 * Fetches personalised artist recommendations for the current user.
 *
 * Returns nothing (empty array) if:
 *  - the user is not authenticated yet
 *  - the user has no watch history (the DB function returns 0 rows)
 *
 * Re-fetches whenever the user identity changes (e.g. anon → registered).
 */
export function useRecommendations(user: User | null) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setRecommendations([])
      return
    }

    let cancelled = false
    setIsLoading(true)

    getRecommendations().then((results) => {
      if (!cancelled) {
        setRecommendations(results)
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  return { recommendations, isLoading }
}
