import { useState, useEffect } from "react"
import { SlidersHorizontal, Calendar, Disc3 } from "lucide-react"
import { useRecentSearches } from "../hooks/useRecentSearches"
import { getSuggestedArtists } from "../data/suggestedArtists"
import type { SearchFilters } from "../services/searchQueries"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

type LandingPageProps = {
  onComplete: () => void
  setSelectedArtist: (artist: { id: string; name: string }, filters?: SearchFilters) => void
}

export default function LandingPage({ onComplete, setSelectedArtist }: LandingPageProps) {
  const [query, setQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [filterYear, setFilterYear] = useState("")
  const [filterAlbum, setFilterAlbum] = useState("")
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

    const year = filterYear.trim()
    const album = filterAlbum.trim()
    const filters: SearchFilters | undefined =
      year || album ? { ...(year && { year }), ...(album && { album }) } : undefined

    addSearch(trimmed)
    setSelectedArtist({
      id: slugify(trimmed),
      name: trimmed.toUpperCase(),
    }, filters)
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

          {/* Advanced filters toggle */}
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="inline-flex items-center gap-2 font-typewriter text-[10px] uppercase tracking-[0.25em] text-black/45 hover:text-black/65"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {showFilters
                ? "Hide Filters"
                : "Or search by year or album"}
            </button>
          </div>

          {showFilters && (
            <div className="flex gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-sm border border-stone-300 bg-transparent px-4 py-3">
                <Calendar className="h-4 w-4 text-black/35 shrink-0" />
                <input
                  type="text"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  placeholder="Year"
                  className="w-full bg-transparent text-base sm:text-sm text-black/85 placeholder:text-black/35 outline-none"
                />
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-sm border border-stone-300 bg-transparent px-4 py-3">
                <Disc3 className="h-4 w-4 text-black/35 shrink-0" />
                <input
                  type="text"
                  value={filterAlbum}
                  onChange={(e) => setFilterAlbum(e.target.value)}
                  placeholder="Album"
                  className="w-full bg-transparent text-base sm:text-sm text-black/85 placeholder:text-black/35 outline-none"
                />
              </div>
            </div>
          )}
        </form>
      </div>

      <div className="py-8 font-typewriter text-[10px] uppercase tracking-[0.35em] text-black/30">
        Encore Atlas · Rediscover the shows you've lived
      </div>
    </div>
  )
}
