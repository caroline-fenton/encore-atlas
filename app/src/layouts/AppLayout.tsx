import { NavLink, Outlet } from "react-router-dom"

const tabs = [
  { to: "/", label: "Live Shows", end: true },
  { to: "/interviews", label: "Interviews" },
  { to: "/merch", label: "Merch" },
] as const

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="font-semibold tracking-tight">Encore Atlas</div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Viewing:</label>
            <select
              className="rounded-lg border px-2 py-1 text-sm"
              defaultValue="The Smiths"
              aria-label="Viewing artist"
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
              className="ml-1 rounded-lg border px-2 py-1 text-sm"
              aria-label="Account (coming soon)"
              onClick={() => {}}
            >
              ☺
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-3xl px-4 pb-3 flex gap-2">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end as boolean | undefined}
              className={({ isActive }) =>
                [
                  "rounded-full px-3 py-1 text-sm font-medium border",
                  isActive ? "bg-black text-white border-black" : "bg-white text-gray-700",
                ].join(" ")
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

