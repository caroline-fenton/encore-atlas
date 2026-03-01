import { NavLink, Outlet } from "react-router-dom"
import { useMemo, useState } from "react"

const tabs = [
  { to: "/", label: "Live Shows", end: true },
  { to: "/interviews", label: "Interviews", end: false },
  { to: "/merch", label: "Merch", end: false },
] as const

const artists = [
  { id: "the-smiths", name: "THE SMITHS" },
  { id: "joy-division", name: "JOY DIVISION" },
  { id: "talking-heads", name: "TALKING HEADS" },
  { id: "pixies", name: "PIXIES" },
] as const

export type AppOutletContext = {
  selectedArtistId: string
  selectedArtistName: string
  setSelectedArtistId: (id: string) => void
}

export default function AppLayout() {
  const [selectedArtistId, setSelectedArtistId] = useState<string>("the-smiths")

  const selectedArtistName = useMemo(() => {
    return artists.find((a) => a.id === selectedArtistId)?.name ?? "THE SMITHS"
  }, [selectedArtistId])

  return (
    <div className="min-h-screen bg-[#f6f1e8] text-black/85">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#f6f1e8]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div className="text-sm font-semibold uppercase tracking-[0.25em]">
            Encore Atlas
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs uppercase tracking-[0.25em] text-black/55">
              Viewing
            </label>

            <select
              className="rounded-sm border border-stone-200 bg-transparent px-2 py-1 text-sm"
              value={selectedArtistId}
              onChange={(e) => setSelectedArtistId(e.target.value)}
            >
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              <option disabled>──────────</option>
              <option disabled>Add artist (Soon)</option>
              <option disabled>Upload concert history (Soon)</option>
            </select>

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
            selectedArtistId,
            selectedArtistName,
            setSelectedArtistId,
          } satisfies AppOutletContext}
        />
      </main>
    </div>
  )
}
