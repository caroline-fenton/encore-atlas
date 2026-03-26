import { X, Calendar, Disc3 } from "lucide-react"
import type { SuggestedArtist } from "../../data/suggestedArtists"

type Props = {
  recentSearches: string[]
  suggestedArtists: SuggestedArtist[]
  filterQuery: string
  highlightedIndex: number
  filterYear: string
  filterAlbum: string
  onFilterYearChange: (value: string) => void
  onFilterAlbumChange: (value: string) => void
  onSelectSuggested: (artist: SuggestedArtist) => void
  onSelectRecent: (query: string) => void
  onRemoveRecent: (query: string) => void
}

export default function SearchSuggestionPanel({
  recentSearches,
  suggestedArtists,
  filterQuery,
  highlightedIndex,
  filterYear,
  filterAlbum,
  onFilterYearChange,
  onFilterAlbumChange,
  onSelectSuggested,
  onSelectRecent,
  onRemoveRecent,
}: Props) {
  const query = filterQuery.toLowerCase()

  const filteredSuggested = query
    ? suggestedArtists.filter((a) => a.name.toLowerCase().includes(query))
    : suggestedArtists

  const filteredRecent = query
    ? recentSearches.filter((s) => s.toLowerCase().includes(query))
    : recentSearches

  // Build flat list for keyboard navigation indexing
  const items: { type: "suggested" | "recent"; value: string; artist?: SuggestedArtist }[] = []

  filteredSuggested.forEach((a) =>
    items.push({ type: "suggested", value: a.id, artist: a }),
  )
  filteredRecent.forEach((s) => items.push({ type: "recent", value: s }))

  // Always show panel when open — filter inputs should be accessible
  // even when no suggestions/recent searches match

  let idx = 0

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-sm border border-stone-200 bg-[#f6f1e8] shadow-md">
      {filteredSuggested.length > 0 && (
        <div>
          <div className="px-3 pb-1 pt-2 font-typewriter text-[10px] uppercase tracking-[0.3em] text-black/40">
            Suggested
          </div>
          {filteredSuggested.map((a) => {
            const itemIdx = idx++
            return (
              <button
                key={a.id}
                type="button"
                className={[
                  "flex w-full items-center px-3 py-2 text-left text-sm",
                  itemIdx === highlightedIndex
                    ? "bg-[#7a2d2b]/10 text-[#7a2d2b]"
                    : "text-black/75 hover:bg-black/5",
                ].join(" ")}
                onMouseDown={(e) => {
                  e.preventDefault() // prevent blur before click fires
                  onSelectSuggested(a)
                }}
                data-index={itemIdx}
              >
                <span className="font-display tracking-[0.08em]">{a.name}</span>
              </button>
            )
          })}
        </div>
      )}

      {filteredRecent.length > 0 && (
        <div>
          {filteredSuggested.length > 0 && (
            <div className="mx-3 border-t border-stone-200" />
          )}
          <div className="px-3 pb-1 pt-2 font-typewriter text-[10px] uppercase tracking-[0.3em] text-black/40">
            Recent
          </div>
          {filteredRecent.map((s) => {
            const itemIdx = idx++
            return (
              <div
                key={s}
                className={[
                  "flex items-center px-3 py-2",
                  itemIdx === highlightedIndex
                    ? "bg-[#7a2d2b]/10"
                    : "hover:bg-black/5",
                ].join(" ")}
                data-index={itemIdx}
              >
                <button
                  type="button"
                  className={[
                    "flex-1 text-left text-sm",
                    itemIdx === highlightedIndex
                      ? "text-[#7a2d2b]"
                      : "text-black/75",
                  ].join(" ")}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onSelectRecent(s)
                  }}
                >
                  {s}
                </button>
                <button
                  type="button"
                  className="ml-2 text-black/30 hover:text-black/60"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onRemoveRecent(s)
                  }}
                  aria-label={`Remove ${s}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div>
        <div className="mx-3 border-t border-stone-200" />
        <div className="px-3 pb-1 pt-2 font-typewriter text-[10px] uppercase tracking-[0.3em] text-black/40">
          Filters
        </div>
        <div className="flex gap-2 px-3 pb-3">
          <div className="flex flex-1 items-center gap-1.5 rounded-sm border border-stone-200 bg-white/50 px-2 py-1.5">
            <Calendar className="h-3 w-3 text-black/35 shrink-0" />
            <input
              type="text"
              value={filterYear}
              onChange={(e) => onFilterYearChange(e.target.value)}
              placeholder="Year"
              className="w-full min-w-0 bg-transparent text-xs text-black/75 placeholder:text-black/35 outline-none"
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex flex-1 items-center gap-1.5 rounded-sm border border-stone-200 bg-white/50 px-2 py-1.5">
            <Disc3 className="h-3 w-3 text-black/35 shrink-0" />
            <input
              type="text"
              value={filterAlbum}
              onChange={(e) => onFilterAlbumChange(e.target.value)}
              placeholder="Album"
              className="w-full min-w-0 bg-transparent text-xs text-black/75 placeholder:text-black/35 outline-none"
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
