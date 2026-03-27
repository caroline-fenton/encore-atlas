import { useState, useEffect } from "react"
import { useRecentSearches } from "../hooks/useRecentSearches"
import { getSuggestedArtists } from "../data/suggestedArtists"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

type LandingPageProps = {
  onComplete: () => void
  setSelectedArtist: (artist: { id: string; name: string }) => void
}

export default function LandingPage({ onComplete, setSelectedArtist }: LandingPageProps) {
  const [query, setQuery] = useState("")
  const { addSearch } = useRecentSearches()
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const suggestedArtists = getSuggestedArtists()

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % suggestedArtists.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [suggestedArtists.length])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    addSearch(trimmed)
    setSelectedArtist({
      id: slugify(trimmed),
      name: trimmed.toUpperCase(),
    })
    onComplete()
  }

  return (
    <div className="flex min-h-screen max-w-full flex-col overflow-hidden text-center px-6">
      <div className="flex flex-1 flex-col items-center justify-center">
        <h1 className="font-display text-6xl md:text-8xl font-normal tracking-[0.08em] text-black/85">
          TURN IT UP.
        </h1>

        <p className="mt-4 max-w-sm font-typewriter text-sm leading-relaxed text-black/55">
          Live moments from your favorite artists' tours
        </p>

        <form onSubmit={handleSubmit} className="mt-10 w-full max-w-md space-y-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={suggestedArtists[placeholderIndex]?.name ?? "Search"}
            className="w-full rounded-sm border border-stone-300 bg-transparent px-5 py-3 text-center text-base sm:text-sm text-black/85 placeholder:text-black/35 outline-none focus:border-[#7a2d2b]/50"
            autoFocus
          />

          <button
            type="submit"
            className="w-full bg-[#7a2d2b] px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.25em] text-white hover:bg-[#7a2d2b]/90"
          >
            Let's Go
          </button>
        </form>
      </div>

      <div className="py-8 font-typewriter text-[10px] uppercase tracking-[0.35em] text-black/30">
        Encore Atlas · Rediscover the shows you've lived
      </div>
    </div>
  )
}
