import { NavLink, Outlet, Link } from "react-router-dom"
import { useState } from "react"
import { User } from "lucide-react"
import ArtistSearchBar from "../components/search/ArtistSearchBar"
import LandingPage from "../pages/LandingPage"
import type { SearchFilters } from "../services/searchQueries"

const tabs = [
  { to: "/", label: "Live Shows", end: true },
  { to: "/music-videos", label: "Music Videos", end: false },
  { to: "/interviews", label: "Interviews", end: false },
  { to: "/merch", label: "Merch", end: false },
] as const

const RECENT_SEARCHES_KEY = "encore_atlas_recent_searches"

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return []
    const searches = JSON.parse(raw)
    return Array.isArray(searches) ? searches : []
  } catch {
    return []
  }
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

type SelectedArtist = {
  id: string
  name: string
}

export type AppOutletContext = {
  selectedArtistId: string
  selectedArtistName: string
  searchFilters: SearchFilters
  setSelectedArtist: (artist: SelectedArtist) => void
}

export default function AppLayout() {
  const recentSearches = getRecentSearches()
  const mostRecent = recentSearches[0]

  const [selectedArtist, setSelectedArtist] = useState<SelectedArtist>(
    mostRecent
      ? { id: toSlug(mostRecent), name: mostRecent.toUpperCase() }
      : { id: "the-smiths", name: "THE SMITHS" },
  )
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({})
  const [showLanding, setShowLanding] = useState(recentSearches.length === 0)

  const handleSelectArtist = (artist: SelectedArtist, filters?: SearchFilters) => {
    setSelectedArtist(artist)
    setSearchFilters(filters ?? {})
  }

  if (showLanding) {
    return (
      <div className="min-h-screen bg-[#f6f1e8] text-black/85">
        <LandingPage
          onComplete={() => setShowLanding(false)}
          setSelectedArtist={handleSelectArtist}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f1e8] text-black/85">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#f6f1e8]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <Link
            to="/"
            className="text-sm font-semibold uppercase tracking-[0.25em] hover:text-black/70"
          >
            Encore Atlas
          </Link>

          <div className="flex min-w-0 items-center gap-3">
            <ArtistSearchBar onSelectArtist={handleSelectArtist} />

            <div className="group relative">
              <button
                className="grid h-9 w-9 place-items-center rounded-sm border border-stone-200 text-black/60"
                aria-label="Account"
              >
                <User className="h-4 w-4" />
              </button>
              <span className="pointer-events-none absolute right-0 top-full mt-1 hidden whitespace-nowrap rounded bg-black/80 px-2 py-1 text-[10px] text-white group-hover:block group-focus-within:block">
                Accounts Coming Soon
              </span>
            </div>
          </div>
        </div>

        <nav className="mx-auto max-w-5xl px-6 pb-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs font-semibold uppercase tracking-[0.25em]">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  [
                    "inline-flex items-center border-b-2 pb-1",
                    isActive
                      ? "border-[#7a2d2b] text-[#7a2d2b]"
                      : "border-transparent text-black/55 hover:text-black/75",
                  ].join(" ")
                }
              >
                {t.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20">
        <Outlet
          context={{
            selectedArtistId: selectedArtist.id,
            selectedArtistName: selectedArtist.name,
            searchFilters,
            setSelectedArtist: handleSelectArtist,
          } satisfies AppOutletContext}
        />
      </main>

      <footer className="border-t border-stone-200 py-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.25em] text-black/30">
          Encore Atlas · Beta ·{" "}
          <a
            href="mailto:hello@encoreatlas.fm?subject=Encore%20Atlas%20Feedback"
            className="text-black/40 hover:text-black/60"
          >
            Send Feedback
          </a>
        </p>
      </footer>
    </div>
  )
}
