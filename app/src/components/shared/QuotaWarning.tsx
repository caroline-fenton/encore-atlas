import { isQuotaExhausted } from "../../services/youtube"

export default function QuotaWarning() {
  if (!isQuotaExhausted()) return null

  return (
    <div className="mx-auto max-w-5xl px-6 py-3">
      <div className="rounded-sm border border-[#7a2d2b]/30 bg-[#7a2d2b]/5 px-4 py-3 text-center font-typewriter text-xs text-[#7a2d2b]">
        Daily search limit reached. Curated artists still work! Try again
        tomorrow.
      </div>
    </div>
  )
}
