import { NavLink, Outlet } from "react-router-dom"

const tabs = [
  { to: "/", label: "Live Shows", end: true },
  { to: "/interviews", label: "Interviews" },
  { to: "/merch", label: "Merch" },
] as const

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#f6f1e8] text-black/85">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-[#f6f1e8]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div className="text-sm font-semibold uppercase tracking-[0.25em]">
            Encore Atlas
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs uppercase tracking-[0.25em] text-black/55">
              Viewing
            </label>

            <select
              className="rounded-sm border border-black/20 bg-transparent px-2 py-1 text-sm"
              defaultValue="The Smiths"
            >
              <option>The Smiths</option>
              <option>Joy Division</option>
              <option>Talking Heads</option>
              <option>Pixies</option>
              <option disabled>──────────</option>
              <option disabled>Add artist (Soon)</option>
              <option disabled>Upload concert history (Soon)</option>
            </select>

            <button
              className="grid h-9 w-9 place-items-center rounded-sm border border-black/20 text-black/60"
              aria-label="Account"
            >
              ☺
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-6 px-6 pb-5">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                [
                  "text-sm font-semibold uppercase tracking-[0.25em]",
                  isActive
                    ? "text-[#7a2d2b]"
                    : "text-black/55 hover:text-black/75",
                ].join(" ")
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20">
        <Outlet />
      </main>
    </div>
  )
}
