export default function MerchPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">BRING SOMETHING HOME</h1>
        <p className="text-sm text-gray-500">Merch links (placeholder)</p>
      </header>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">The Smiths</h2>
        <div className="grid grid-cols-1 gap-3">
          {[
            { name: "Tour Tee", type: "Shirt" },
            { name: "Greatest Hits", type: "Vinyl" },
            { name: "Band Photo Print", type: "Poster" },
          ].map((item) => (
            <div key={item.name} className="rounded-2xl border bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-gray-500">{item.type}</p>
              </div>
              <a
                className="text-sm font-medium underline"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                Visit store
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

