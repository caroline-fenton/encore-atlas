import { useState, useEffect } from "react"
import { isQuotaExhausted } from "../../services/youtube"

export default function QuotaWarning() {
  const [exhausted, setExhausted] = useState(isQuotaExhausted)

  useEffect(() => {
    const onQuotaExhausted = () => setExhausted(true)
    window.addEventListener("quota-exhausted", onQuotaExhausted)
    return () => window.removeEventListener("quota-exhausted", onQuotaExhausted)
  }, [])

  if (!exhausted) return null

  return (
    <div className="mx-auto max-w-5xl px-6 py-3">
      <div className="rounded-sm border border-[#d94f43]/30 bg-[#d94f43]/5 px-4 py-3 text-center font-typewriter text-xs text-[#d94f43]">
        Daily search limit reached. Curated artists still work! Try again
        tomorrow.
      </div>
    </div>
  )
}
