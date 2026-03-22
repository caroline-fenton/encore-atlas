import { NavLink, Outlet, Link } from "react-router-dom"
import { useState } from "react"
import ArtistSearchBar from "../components/search/ArtistSearchBar"
import LandingPage from "../pages/LandingPage"

const tabs = [
  { to: "/", label: "Live Shows", end: true },
  { to: "/interviews", label: "Interviews", end: false },
  { to: "/merch", label: "Merch", end: false },
] as const

const RECENT_SEARCHES_KEY = "encore_atlas_recent_searches"

function hasSearched(): boolean {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return false
    const searches = JSON.parse(raw)
    return Array.isArray(searches) && searches.length > 0
  } catch {
    return false
  }
}

type SelectedArtist = {
  id: string
  name: string
}

export type AppOutletContext = {
  selectedArtistId: string
  selectedArtistName: string
  setSelectedArtist: (artist: SelectedArtist) => void
}

export default function AppLayout() {
  const [selectedArtist, setSelectedArtist] = useState<SelectedArtist>({
    id: "the-smiths",
    name: "THE SMITHS",
  })
  const [showLanding, setShowLanding] = useState(!hasSearched())

  if (showLanding) {
    return (
      <div className="min-h-screen bg-[#f6f1e8] text-black/85">
        <LandingPage
          onComplete={() => setShowLanding(false)}
          setSelectedArtist={setSelectedArtist}
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
            <label className="hidden text-xs uppercase tracking-[0.25em] text-black/55 sm:block">
              Viewing
            </label>

            <ArtistSearchBar onSelectArtist={setSelectedArtist} />

            <button
              className="grid h-9 w-9 place-items-center rounded-sm border border-stone-200 text-black/60"
              aria-label="Account"
            >
              ☺
            </button>
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
            setSelectedArtist,
          } satisfies AppOutletContext}
        />
      </main>
    </div>
  )
}
