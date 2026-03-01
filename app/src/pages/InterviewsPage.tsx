import { ExternalLink, Share2 } from "lucide-react"

export default function InterviewsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">IN THEIR OWN WORDS</h1>
        <p className="text-sm text-gray-500">Interviews & oral histories (placeholder)</p>
      </header>

      <div className="grid grid-cols-1 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="h-16 w-28 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                Thumb
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">Speaker Name {i + 1}</p>
                <p className="text-xs text-gray-500">BBC Radio • 32:10</p>
                <button className="mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium">
                  <ExternalLink className="h-4 w-4" />
                  Watch on YouTube
                </button>
              </div>
              <button
                className="ml-auto text-gray-500 hover:text-gray-700"
                onClick={() => {}}
                aria-label="Share (coming soon)"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

