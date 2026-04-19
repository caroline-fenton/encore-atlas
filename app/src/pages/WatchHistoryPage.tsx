import { useState, useEffect } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { getRecentWatchHistory } from "../services/watchHistory"
import type { WatchHistoryEntry } from "../services/watchHistory"
import type { AppOutletContext } from "../layouts/AppLayout"

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function WatchHistoryPage() {
  // Consume the single auth session from AppLayout via outlet context
  // rather than calling useAuth() again (would race parallel bootstraps).
  const { setSelectedArtist, user, waitForAuth } =
    useOutletContext<AppOutletContext>()
  const navigate = useNavigate()

  const [history, setHistory] = useState<WatchHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const resolvedUser = user ?? (await waitForAuth())
      if (cancelled) return
      if (!resolvedUser) {
        setIsLoading(false)
        return
      }
      const rows = await getRecentWatchHistory(resolvedUser.id)
      if (cancelled) return
      setHistory(rows)
      setIsLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [user, waitForAuth])

  function handleSelect(entry: WatchHistoryEntry) {
    const artistName = entry.artists?.name
    if (!artistName) return
    setSelectedArtist({ id: toSlug(artistName), name: artistName.toUpperCase() })
    navigate("/")
  }

  return (
    <div className="space-y-8 pb-10">
      <header className="text-center">
        <h1 className="font-display text-5xl md:text-6xl font-normal tracking-[0.22em] leading-none text-black/80 uppercase">
          History
        </h1>
        <div className="mt-3 font-typewriter text-xs uppercase tracking-[0.35em] text-black/55">
          Recently Watched
        </div>
      </header>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex h-[72px] animate-pulse gap-4 rounded-lg border border-black/8 bg-white/40 p-3"
            >
              <div className="h-full w-[88px] shrink-0 rounded bg-black/10" />
              <div className="flex flex-1 flex-col justify-center gap-2">
                <div className="h-3.5 w-3/4 rounded bg-black/10" />
                <div className="h-3 w-1/3 rounded bg-black/8" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && history.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-typewriter text-xs uppercase tracking-[0.25em] text-black/35">
            No watch history yet
          </p>
          <p className="mt-2 text-sm text-black/40">
            Videos you watch will appear here.
          </p>
        </div>
      )}

      {!isLoading && history.length > 0 && (
        <div className="space-y-2">
          {history.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => handleSelect(entry)}
              className="flex w-full items-center gap-4 rounded-lg border border-black/8 bg-white/40 p-3 text-left transition hover:bg-white/60"
            >
              <div className="relative h-[64px] w-[104px] shrink-0 overflow-hidden rounded bg-black/5">
                <img
                  src={`https://img.youtube.com/vi/${entry.youtube_video_id}/mqdefault.jpg`}
                  alt={entry.video_title}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold tracking-[0.01em] text-black/80">
                  {entry.video_title}
                </div>
                {entry.artists?.name && (
                  <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">
                    {entry.artists.name}
                  </div>
                )}
                <div className="mt-1 text-[11px] text-black/35">
                  {formatRelativeTime(entry.watched_at)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
