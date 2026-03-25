import { useState, useRef, useCallback } from "react"
import { track } from "@vercel/analytics"
import { Search } from "lucide-react"
import { getSuggestedArtists, type SuggestedArtist } from "../../data/suggestedArtists"
import { useRecentSearches } from "../../hooks/useRecentSearches"
import SearchSuggestionPanel from "./SearchSuggestionPanel"
import type { SearchFilters } from "../../services/searchQueries"

type SelectedArtist = {
  id: string
  name: string
}

type Props = {
  onSelectArtist: (artist: SelectedArtist, filters?: SearchFilters) => void
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export default function ArtistSearchBar({ onSelectArtist }: Props) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [filterYear, setFilterYear] = useState("")
  const [filterAlbum, setFilterAlbum] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { searches, addSearch, removeSearch } = useRecentSearches()

  const suggestedArtists = getSuggestedArtists()

  // Build the flat item list (same as panel) for keyboard nav
  const getItems = useCallback(() => {
    const q = query.toLowerCase()
    const filteredSuggested = q
      ? suggestedArtists.filter((a) => a.name.toLowerCase().includes(q))
      : suggestedArtists
    const filteredRecent = q
      ? searches.filter((s) => s.toLowerCase().includes(q))
      : searches

    const items: { type: "suggested" | "recent"; value: string; artist?: SuggestedArtist }[] = []
    filteredSuggested.forEach((a) => items.push({ type: "suggested", value: a.id, artist: a }))
    filteredRecent.forEach((s) => items.push({ type: "recent", value: s }))
    return items
  }, [query, suggestedArtists, searches])

  const buildFilters = useCallback((): SearchFilters | undefined => {
    const year = filterYear.trim()
    const album = filterAlbum.trim()
    if (!year && !album) return undefined
    return { ...(year && { year }), ...(album && { album }) }
  }, [filterYear, filterAlbum])

  const clearAndClose = useCallback(() => {
    setQuery("")
    setFilterYear("")
    setFilterAlbum("")
    setIsOpen(false)
    setHighlightedIndex(-1)
    inputRef.current?.blur()
  }, [])

  const handleSelectArtist = useCallback(
    (artist: SuggestedArtist) => {
      track("artist_search", { artist: artist.name, source: "suggested" })
      addSearch(artist.name)
      onSelectArtist({ id: artist.id, name: artist.name }, buildFilters())
      clearAndClose()
    },
    [onSelectArtist, addSearch, buildFilters, clearAndClose],
  )

  const handleSelectSearch = useCallback(
    (searchQuery: string) => {
      const trimmed = searchQuery.trim()
      if (!trimmed) return

      // Check if it matches a suggested artist
      const suggested = suggestedArtists.find(
        (a) => a.name.toLowerCase() === trimmed.toLowerCase(),
      )
      if (suggested) {
        handleSelectArtist(suggested)
        return
      }

      track("artist_search", { artist: trimmed, source: "custom" })
      addSearch(trimmed)
      onSelectArtist({
        id: slugify(trimmed),
        name: trimmed.toUpperCase(),
      }, buildFilters())
      clearAndClose()
    },
    [suggestedArtists, addSearch, onSelectArtist, handleSelectArtist, buildFilters, clearAndClose],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = getItems()

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < items.length - 1 ? prev + 1 : 0,
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : items.length - 1,
        )
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < items.length) {
          const item = items[highlightedIndex]
          if (item.type === "suggested" && item.artist) {
            handleSelectArtist(item.artist)
          } else {
            handleSelectSearch(item.value)
          }
        } else if (query.trim()) {
          handleSelectSearch(query)
        }
        break
      case "Escape":
        setIsOpen(false)
        setHighlightedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // If focus is moving to another element within our container, stay open
    const relatedTarget = e.relatedTarget as Node | null
    if (relatedTarget && containerRef.current?.contains(relatedTarget)) {
      return
    }
    // Delay to allow mouseDown on suggestions to fire
    setTimeout(() => setIsOpen(false), 150)
  }, [])

  return (
    <div className="relative" ref={containerRef} onBlur={handleBlur}>
      <div className="flex items-center gap-2 rounded-sm border border-stone-200 bg-transparent px-2 py-1">
        <Search className="h-3.5 w-3.5 text-black/40" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlightedIndex(-1)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search"
          className="w-24 sm:w-40 bg-transparent text-base sm:text-sm text-black/85 placeholder:text-black/35 outline-none"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        />
      </div>

      {isOpen && (
        <SearchSuggestionPanel
          recentSearches={searches}
          suggestedArtists={suggestedArtists}
          filterQuery={query}
          highlightedIndex={highlightedIndex}
          filterYear={filterYear}
          filterAlbum={filterAlbum}
          onFilterYearChange={setFilterYear}
          onFilterAlbumChange={setFilterAlbum}
          onSelectSuggested={handleSelectArtist}
          onSelectRecent={handleSelectSearch}
          onRemoveRecent={removeSearch}
        />
      )}
    </div>
  )
}
