import { useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import type { AppOutletContext } from "../layouts/AppLayout"
import { useRecentSearches } from "../hooks/useRecentSearches"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export default function LandingPage() {
  const [query, setQuery] = useState("")
  const { setSelectedArtist } = useOutletContext<AppOutletContext>()
  const { addSearch } = useRecentSearches()
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    addSearch(trimmed)
    setSelectedArtist({
      id: slugify(trimmed),
      name: trimmed.toUpperCase(),
    })
    navigate("/")
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
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
          placeholder="The Smiths"
          className="w-full rounded-sm border border-stone-300 bg-transparent px-5 py-3 text-center text-sm text-black/85 placeholder:text-black/35 outline-none focus:border-[#7a2d2b]/50"
          autoFocus
        />

        <button
          type="submit"
          className="w-full bg-[#7a2d2b] px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.25em] text-white hover:bg-[#7a2d2b]/90"
        >
          Let's Go
        </button>
      </form>

      <div className="mt-auto pt-16 font-typewriter text-[10px] uppercase tracking-[0.35em] text-black/30">
        Encore Atlas · Rediscover the shows you've lived
      </div>
    </div>
  )
}
