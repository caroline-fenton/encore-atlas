export default function LiveShowsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">THE SMITHS</h1>
        <p className="text-sm text-gray-500">Live Performances</p>
      </header>

      <section className="rounded-2xl border bg-white p-4">
        <div className="aspect-video w-full rounded-xl bg-gray-200 flex items-center justify-center text-gray-500">
          Featured video hero (placeholder)
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Complete Concert</p>
            <p className="text-xs text-gray-500">The Apollo • 1986</p>
          </div>
          <a
            className="text-sm font-medium underline"
            href="#"
            onClick={(e) => e.preventDefault()}
          >
            Watch on YouTube
          </a>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">More Live Sets</h2>
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="h-16 w-28 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                  Thumb
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">Live Set Title {i + 1}</p>
                  <p className="text-xs text-gray-500">Venue • 198{6 + i}</p>
                </div>
                <span className="ml-auto text-xs text-gray-600">58:12</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

