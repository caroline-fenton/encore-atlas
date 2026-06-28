import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Pencil, Plus, X } from "lucide-react"
import { Link } from "react-router-dom"
import {
  generateRefreshPreview,
  getAdminSession,
  previewReplacementVideo,
  publishContentRefresh,
  searchAdminArtists,
  sendAdminMagicLink,
  signOutAdmin,
  type AdminArtist,
  type ContentRefresh,
  type RefreshArtist,
  type RefreshScope,
  type RefreshVideo,
} from "../services/adminContentRefresh"
import { ensureSession } from "../services/auth"

const scopeOptions: Array<{
  value: RefreshScope
  label: string
  detail: string
}> = [
  {
    value: "metadata",
    label: "Artist metadata",
    detail: "Only use when those fields are wrong or missing",
  },
  {
    value: "same_vibe",
    label: "Same-vibe artists",
    detail: "Only use when related artists need repair",
  },
  {
    value: "videos",
    label: "Live video content",
    detail: "Review current live videos and replace only bad ones",
  },
]

function valueText(value: unknown): string {
  if (value == null || value === "") return "Not set"
  if (Array.isArray(value)) return value.join(", ") || "None"
  return String(value)
}

function ChangeRow({
  label,
  before,
  after,
}: {
  label: string
  before: unknown
  after: unknown
}) {
  const oldValue = valueText(before)
  const newValue = valueText(after)
  const changed = oldValue !== newValue
  return (
    <div className="grid gap-2 border-t border-stone-200 py-3 md:grid-cols-[10rem_1fr_1fr]">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-black/55">
        {label}
      </div>
      <div className="text-sm leading-relaxed text-black/55">{oldValue}</div>
      <div className={changed ? "text-sm leading-relaxed text-[#a33b33]" : "text-sm leading-relaxed text-black/55"}>
        {newValue}
      </div>
    </div>
  )
}

function EditableField({
  label,
  before,
  children,
}: {
  label: string
  before: unknown
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2 border-t border-stone-200 py-3 md:grid-cols-[10rem_1fr_1fr]">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-black/55">{label}</div>
      <div className="text-sm leading-relaxed text-black/55">{valueText(before)}</div>
      <div>{children}</div>
    </div>
  )
}

function editableMetadataSignature(artist: RefreshArtist, scopes: RefreshScope[]) {
  return JSON.stringify({
    metadata: scopes.includes("metadata") ? {
      tags: artist.tags ?? [],
      blurb: artist.blurb ?? null,
      city: artist.artist_context?.city ?? null,
      yearsActive: artist.artist_context?.yearsActive ?? null,
      wikipediaUrl: artist.wikipedia_url ?? null,
    } : null,
    sameVibe: scopes.includes("same_vibe")
      ? artist.artist_context?.relatedArtists ?? []
      : null,
  })
}

function editableVideoSignature(videos: RefreshVideo[]) {
  return JSON.stringify(videos.map((video) => ({
    youtube_video_id: video.youtube_video_id,
    is_manually_added: video.is_manually_added,
    display_order: video.display_order,
    video_type: video.video_type,
  })))
}

function concertVideos(videos: RefreshVideo[]) {
  return videos
    .filter((video) => (video.video_type ?? "concert") === "concert")
    .sort((a, b) => a.display_order - b.display_order)
}

function stagePreviewVideos(beforeVideos: RefreshVideo[], proposedVideos: RefreshVideo[]) {
  const proposedById = new Map(
    concertVideos(proposedVideos).map((video) => [video.youtube_video_id, video]),
  )
  const staged = concertVideos(beforeVideos).map((video) => ({
    ...(proposedById.get(video.youtube_video_id) ?? video),
    display_order: video.display_order,
  }))
  const stagedIds = new Set(staged.map((video) => video.youtube_video_id))
  const additions = concertVideos(proposedVideos)
    .filter((video) => !stagedIds.has(video.youtube_video_id))
    .map((video, index) => ({
      ...video,
      display_order: staged.length + index,
    }))

  return [...staged, ...additions]
}

function iconButtonClass(tone: "edit" | "remove" | "add" = "edit") {
  const tones = {
    edit: "border-[#9256a8]/35 text-[#9256a8] hover:bg-[#9256a8]/5",
    remove: "border-[#a33b33]/35 text-[#a33b33] hover:bg-[#a33b33]/5",
    add: "border-[#3580b0]/35 text-[#3580b0] hover:bg-[#3580b0]/5",
  }
  return [
    "inline-flex h-8 w-8 items-center justify-center border bg-white/45 transition disabled:cursor-not-allowed disabled:opacity-40",
    tones[tone],
  ].join(" ")
}

function focusControl(id: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.focus()
  })
}

function AddVideoForm({
  onAdd,
}: {
  onAdd: (video: RefreshVideo) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    setLoading(true)
    setError(null)
    try {
      const video = await previewReplacementVideo(url)
      onAdd(video)
      setShowAdd(false)
      setUrl("")
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not load that video")
    } finally {
      setLoading(false)
    }
  }

  if (!showAdd) {
    return (
      <button
        type="button"
        onClick={() => setShowAdd(true)}
        className="inline-flex items-center gap-2 border border-[#3580b0]/35 bg-white/45 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#3580b0] hover:bg-[#3580b0]/5"
      >
        <Plus className="h-3.5 w-3.5" />
        Add video
      </button>
    )
  }

  return (
    <div className="border border-[#3580b0]/25 bg-[#3580b0]/5 p-3">
      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
        New YouTube URL
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="min-w-0 flex-1 border border-stone-300 bg-white/70 px-3 py-2 text-sm outline-none focus:border-[#3580b0]"
        />
        <button
          type="button"
          disabled={loading || !url.trim()}
          onClick={handleAdd}
          className="inline-flex items-center justify-center gap-2 border border-[#3580b0] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#3580b0] disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" />
          {loading ? "Checking..." : "Add"}
        </button>
        <button
          type="button"
          onClick={() => { setShowAdd(false); setUrl(""); setError(null) }}
          className={iconButtonClass("remove")}
          aria-label="Cancel add video"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-[#a33b33]">{error}</p>}
    </div>
  )
}

function VideoPreview({
  video,
  changeLabel,
  isProtectedManual,
  onRemove,
  onReplace,
}: {
  video: RefreshVideo
  changeLabel: string
  isProtectedManual: boolean
  onRemove: () => void
  onReplace: (video: RefreshVideo, replacedManualVideoId: string | null) => void
}) {
  const [showReplace, setShowReplace] = useState(false)
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const watchUrl = `https://www.youtube.com/watch?v=${video.youtube_video_id}`
  const embedUrl = `https://www.youtube.com/embed/${video.youtube_video_id}`

  async function handleReplacement() {
    if (
      isProtectedManual
      && !window.confirm(
        "Replace protected manual video? This removes your previous selection when the overall preview is published.",
      )
    ) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const replacement = await previewReplacementVideo(url)
      onReplace(
        { ...replacement, display_order: video.display_order },
        isProtectedManual ? video.youtube_video_id : null,
      )
      setShowReplace(false)
      setUrl("")
    } catch (replacementError) {
      setError(
        replacementError instanceof Error
          ? replacementError.message
          : "Could not load that video",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <article className="border border-stone-300 bg-white/35 p-3">
      <div className="flex gap-4">
        <a href={watchUrl} target="_blank" rel="noreferrer" className="shrink-0">
          <img
            src={video.thumbnail_url ?? `https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`}
            alt=""
            className="h-20 w-32 object-cover"
          />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-snug">{video.title}</h3>
            <span className={[
              "text-[10px] font-semibold uppercase tracking-[0.14em]",
              video.is_manually_added ? "text-[#3580b0]" : "text-black/40",
            ].join(" ")}>
              {changeLabel}
            </span>
          </div>
          <a href={watchUrl} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs text-[#3580b0] underline">
            {watchUrl}
          </a>
          <div className="mt-1 truncate font-mono text-[10px] text-black/35">
            Embed: {embedUrl}
          </div>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => setShowReplace((value) => !value)}
              className={iconButtonClass("edit")}
              aria-label={isProtectedManual ? "Replace protected video" : "Replace video"}
              title={isProtectedManual ? "Replace protected video" : "Replace video"}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className={iconButtonClass("remove")}
              aria-label="Remove video"
              title="Remove video"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showReplace && (
        <div className="mt-4 border-t border-stone-200 pt-4">
          {isProtectedManual && (
            <p className="mb-3 border border-[#a33b33]/30 bg-[#a33b33]/5 p-3 text-sm text-[#82332d]">
              This protected selection will be removed only after you confirm the replacement and publish the overall preview.
            </p>
          )}
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
            Replacement YouTube URL
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="min-w-0 flex-1 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8]"
            />
            <button type="button" disabled={loading || !url.trim()} onClick={handleReplacement} className="border border-[#9256a8] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#9256a8] disabled:opacity-40">
              {loading ? "Checking..." : "Preview replacement"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-[#a33b33]">{error}</p>}
        </div>
      )}
    </article>
  )
}

export default function AdminContentRefreshPage() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof getAdminSession>> | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [query, setQuery] = useState("")
  const [artists, setArtists] = useState<AdminArtist[]>([])
  const [selectedArtist, setSelectedArtist] = useState<AdminArtist | null>(null)
  const [scopes, setScopes] = useState<RefreshScope[]>(["videos"])
  const [refresh, setRefresh] = useState<ContentRefresh | null>(null)
  const [proposedArtist, setProposedArtist] = useState<RefreshArtist | null>(null)
  const [videos, setVideos] = useState<RefreshVideo[]>([])
  const [explicitVideoRemovals, setExplicitVideoRemovals] = useState<string[]>([])
  const [manualVideoReplacements, setManualVideoReplacements] = useState<string[]>([])
  const [manualVideoRemovals, setManualVideoRemovals] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [published, setPublished] = useState(false)

  const loadSession = useCallback(async () => {
    setSessionError(null)
    try {
      await ensureSession()
      setSession(await getAdminSession())
    } catch (loadError) {
      setSessionError(loadError instanceof Error ? loadError.message : "Could not check admin access")
    }
  }, [])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  useEffect(() => {
    if (!session?.is_admin) return
    const timer = window.setTimeout(() => {
      searchAdminArtists(query)
        .then(setArtists)
        .catch((searchError) => setError(searchError.message))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query, session?.is_admin])

  const hasManualMetadataEdits = useMemo(
    () => Boolean(
      refresh
      && proposedArtist
      && editableMetadataSignature(proposedArtist, refresh.scopes)
        !== editableMetadataSignature(refresh.proposed_snapshot.artist, refresh.scopes)
    ),
    [proposedArtist, refresh],
  )
  const hasVideoEdits = useMemo(
    () => Boolean(
      refresh?.scopes.includes("videos")
      && (
        editableVideoSignature(videos) !== editableVideoSignature(refresh.proposed_snapshot.videos)
        || manualVideoReplacements.length > 0
        || manualVideoRemovals.length > 0
      )
    ),
    [manualVideoRemovals.length, manualVideoReplacements.length, refresh, videos],
  )
  const publishWarnings = useMemo(() => {
    const warnings: string[] = []
    if (
      refresh?.before_snapshot.artist.is_curated
      && refresh.scopes.some((scope) => scope === "metadata" || scope === "same_vibe")
    ) {
      warnings.push("Curated metadata and same-vibe changes are preview-only and cannot be published.")
    }
    if (refresh?.scopes.includes("videos") && videos.length === 0) {
      warnings.push("A video refresh cannot publish an empty video list.")
    }
    if (
      refresh?.scopes.length === 1
      && refresh.scopes.includes("videos")
      && !hasVideoEdits
    ) {
      warnings.push("Remove or replace at least one video before publishing a video repair.")
    }
    if (
      refresh
      && !(refresh.scopes.length === 1 && refresh.scopes.includes("videos"))
      && !hasManualMetadataEdits
      && !hasVideoEdits
    ) {
      warnings.push("Make at least one selected edit before publishing.")
    }
    return warnings
  }, [hasManualMetadataEdits, hasVideoEdits, refresh, videos])
  const beforeVideoIds = useMemo(
    () => new Set(
      refresh?.before_snapshot.videos
        .filter((video) => (video.video_type ?? "concert") === "concert")
        .map((video) => video.youtube_video_id) ?? [],
    ),
    [refresh],
  )
  const beforeManualVideoIds = useMemo(
    () => new Set(
      refresh?.before_snapshot.videos
        .filter((video) =>
          (video.video_type ?? "concert") === "concert"
          && video.is_manually_added
        )
        .map((video) => video.youtube_video_id) ?? [],
    ),
    [refresh],
  )
  const removedVideos = useMemo(() => {
    return refresh?.before_snapshot.videos.filter(
      (video) =>
        (video.video_type ?? "concert") === "concert"
        && !video.is_manually_added
        && explicitVideoRemovals.includes(video.youtube_video_id),
    ) ?? []
  }, [explicitVideoRemovals, refresh])
  const replacedManualVideos = useMemo(
    () => refresh?.before_snapshot.videos.filter(
      (video) => manualVideoReplacements.includes(video.youtube_video_id),
    ) ?? [],
    [manualVideoReplacements, refresh],
  )
  const removedManualVideos = useMemo(
    () => refresh?.before_snapshot.videos.filter(
      (video) => manualVideoRemovals.includes(video.youtube_video_id),
    ) ?? [],
    [manualVideoRemovals, refresh],
  )
  const protectedManualVideosByReplacementPosition = useMemo(
    () => new Map(
      refresh?.before_snapshot.videos
        .filter((video) =>
          (video.video_type ?? "concert") === "concert"
          && video.is_manually_added
          && manualVideoReplacements.includes(video.youtube_video_id)
        )
        .map((video) => [video.display_order, video]) ?? [],
    ),
    [manualVideoReplacements, refresh],
  )

  function updateArtistContext(patch: Partial<NonNullable<RefreshArtist["artist_context"]>>) {
    if (!proposedArtist?.artist_context) return
    setProposedArtist({
      ...proposedArtist,
      artist_context: {
        ...proposedArtist.artist_context,
        ...patch,
      },
    })
  }

  function resetMetadataField(field: "tags" | "blurb" | "city" | "yearsActive" | "wikipediaUrl") {
    if (!proposedArtist || !refresh) return
    const currentArtist = refresh.before_snapshot.artist
    if (field === "tags") {
      setProposedArtist({ ...proposedArtist, tags: currentArtist.tags ?? [] })
      return
    }
    if (field === "blurb") {
      setProposedArtist({ ...proposedArtist, blurb: currentArtist.blurb ?? "" })
      return
    }
    if (field === "city") {
      updateArtistContext({ city: currentArtist.artist_context?.city ?? null })
      return
    }
    if (field === "wikipediaUrl") {
      setProposedArtist({ ...proposedArtist, wikipedia_url: currentArtist.wikipedia_url ?? "" })
      return
    }
    updateArtistContext({ yearsActive: currentArtist.artist_context?.yearsActive ?? null })
  }

  function restoreVideo(video: RefreshVideo) {
    setVideos((current) => {
      if (current.some((item) => item.youtube_video_id === video.youtube_video_id)) {
        return current
      }
      return [...current, video].sort((a, b) => a.display_order - b.display_order)
    })
    setExplicitVideoRemovals((current) =>
      current.filter((id) => id !== video.youtube_video_id),
    )
    setManualVideoRemovals((current) =>
      current.filter((id) => id !== video.youtube_video_id),
    )
    setManualVideoReplacements((current) =>
      current.filter((id) => id !== video.youtube_video_id),
    )
  }

  async function handleMagicLink() {
    setBusy(true)
    setSessionError(null)
    try {
      await sendAdminMagicLink(email)
      setMagicLinkSent(true)
    } catch (linkError) {
      setSessionError(linkError instanceof Error ? linkError.message : "Could not send sign-in link")
    } finally {
      setBusy(false)
    }
  }

  async function handlePreview() {
    if (!selectedArtist) return
    setBusy(true)
    setError(null)
    setRefresh(null)
    setProposedArtist(null)
    setExplicitVideoRemovals([])
    setManualVideoReplacements([])
    setManualVideoRemovals([])
    setPublished(false)
    try {
      const result = await generateRefreshPreview(selectedArtist.id, scopes)
      setRefresh(result)
      setProposedArtist(result.proposed_snapshot.artist)
      setVideos(
        result.scopes.includes("videos")
          ? stagePreviewVideos(
            result.before_snapshot.videos,
            result.proposed_snapshot.videos,
          )
          : result.proposed_snapshot.videos,
      )
      setExplicitVideoRemovals([])
      setManualVideoReplacements([])
      setManualVideoRemovals([])
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not generate preview")
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish() {
    if (!refresh || !proposedArtist) return
    setBusy(true)
    setError(null)
    try {
      await publishContentRefresh(
        refresh.id,
        proposedArtist,
        videos,
        manualVideoReplacements,
        manualVideoRemovals,
      )
      setPublished(true)
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Could not publish refresh")
    } finally {
      setBusy(false)
    }
  }

  if (!session) {
    return <div className="grid min-h-screen place-items-center bg-[#f6f1e8] text-sm text-black/55">{sessionError ?? "Checking admin access..."}</div>
  }

  if (!session.is_admin) {
    return (
      <main className="mx-auto min-h-screen max-w-lg px-6 py-20">
        <Link to="/" className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">← Encore Atlas</Link>
        <h1 className="mt-10 font-display text-5xl tracking-[0.12em]">Content Refresh</h1>
        <p className="mt-4 text-sm leading-relaxed text-black/60">
          This route requires an explicitly provisioned admin account.
        </p>
        {session.email && !session.is_anonymous && (
          <p className="mt-4 border border-[#a33b33]/30 bg-[#a33b33]/5 p-3 text-sm text-[#a33b33]">
            {session.email} does not have admin access.
          </p>
        )}
        <div className="mt-8 space-y-3">
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Admin email" className="w-full border border-stone-300 bg-white/50 px-3 py-3 text-sm outline-none focus:border-black/50" />
          <button type="button" disabled={busy || !email.trim()} onClick={handleMagicLink} className="w-full bg-black/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#f6f1e8] disabled:opacity-40">
            {busy ? "Sending..." : "Send magic sign-in link"}
          </button>
          {magicLinkSent && <p className="text-sm text-[#3580b0]">Check your email for the admin sign-in link.</p>}
          {sessionError && <p className="text-sm text-[#a33b33]">{sessionError}</p>}
        </div>
      </main>
    )
  }

  const beforeArtist = refresh?.before_snapshot.artist
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-300 pb-6">
        <div>
          <Link to="/" className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">← Encore Atlas</Link>
          <h1 className="mt-4 font-display text-5xl tracking-[0.12em]">Content Refresh</h1>
          <p className="mt-2 text-sm text-black/55">Preview selected fixes before publishing. Existing metadata stays unchanged unless selected.</p>
        </div>
        <button type="button" onClick={() => signOutAdmin().then(() => window.location.reload())} className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">
          Sign out {session.email}
        </button>
      </div>

      <section className="py-8">
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-black/55">Find artist</label>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search existing artists" className="mt-2 w-full border border-stone-300 bg-white/45 px-4 py-3 text-sm outline-none focus:border-black/50" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((artist) => (
            <button key={artist.id} type="button" onClick={() => { setSelectedArtist(artist); setRefresh(null); setProposedArtist(null); setPublished(false) }} className={[
              "border p-3 text-left",
              selectedArtist?.id === artist.id ? "border-[#d94f43] bg-white/70" : "border-stone-300 bg-white/30",
            ].join(" ")}>
              <div className="font-semibold">{artist.name}</div>
              <div className="mt-1 text-xs text-black/45">
                {artist.is_curated ? "Curated · " : ""}
                {artist.last_refreshed_at ? `Refreshed ${new Date(artist.last_refreshed_at).toLocaleDateString()}` : "Never refreshed"}
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedArtist && (
        <section className="border-t border-stone-300 py-8">
          <h2 className="font-display text-3xl tracking-[0.1em]">{selectedArtist.name}</h2>
          {selectedArtist.is_curated && (
            <div className="mt-4 border border-[#a33b33]/35 bg-[#a33b33]/5 p-4 text-sm text-[#82332d]">
              <strong>Curated artist: metadata is locked.</strong> You can review metadata and same-vibe fields, but publishing those scopes is disabled. Video repairs remain available.
            </div>
          )}
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {scopeOptions.map((option) => (
              <label key={option.value} className="flex cursor-pointer gap-3 border border-stone-300 bg-white/30 p-4">
                <input type="checkbox" checked={scopes.includes(option.value)} onChange={() => setScopes((current) => current.includes(option.value) ? current.filter((scope) => scope !== option.value) : [...current, option.value])} />
                <span>
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-black/45">{option.detail}</span>
                </span>
              </label>
            ))}
          </div>
          <button type="button" disabled={busy || scopes.length === 0} onClick={handlePreview} className="mt-5 bg-black/80 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#f6f1e8] disabled:opacity-40">
            {busy ? "Preparing preview..." : "Prepare preview"}
          </button>
        </section>
      )}

      {error && <div className="mb-6 border border-[#a33b33]/35 bg-[#a33b33]/5 p-4 text-sm text-[#82332d]">{error}</div>}
      {published && <div className="mb-6 border border-[#5a9a6e]/45 bg-[#5a9a6e]/10 p-4 text-sm text-[#356444]">Refresh published successfully.</div>}

      {refresh && beforeArtist && proposedArtist && (
        <section className="space-y-10 border-t border-stone-300 py-8">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl tracking-[0.1em]">Metadata Preview</h2>
                <p className="mt-1 text-sm text-black/50">
                  Left is the current site snapshot. Right is the proposed publish state for selected scopes.
                </p>
              </div>
              {hasManualMetadataEdits && (
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9256a8]">
                  Manual edits
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-[10rem_1fr_1fr] gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">
              <span>Field</span><span>Current site</span><span>Proposed publish</span>
            </div>
            {refresh.scopes.includes("metadata") ? (
              <>
                <EditableField label="Genres" before={beforeArtist.tags}>
                  <div className="flex gap-2">
                    <input
                      id="metadata-tags"
                      value={(proposedArtist.tags ?? []).join(", ")}
                      disabled={beforeArtist.is_curated}
                      onChange={(event) => setProposedArtist({
                        ...proposedArtist,
                        tags: event.target.value.split(",").map((tag) => tag.trim()),
                      })}
                      className="min-w-0 flex-1 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8] disabled:opacity-50"
                    />
                    <button type="button" disabled={beforeArtist.is_curated} onClick={() => focusControl("metadata-tags")} className={iconButtonClass("edit")} aria-label="Edit genres" title="Edit genres">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={beforeArtist.is_curated} onClick={() => resetMetadataField("tags")} className={iconButtonClass("remove")} aria-label="Revert genres" title="Revert genres">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </EditableField>
                <EditableField label="Summary" before={beforeArtist.blurb}>
                  <div className="flex items-start gap-2">
                    <textarea
                      id="metadata-blurb"
                      value={proposedArtist.blurb ?? ""}
                      disabled={beforeArtist.is_curated}
                      rows={5}
                      onChange={(event) => setProposedArtist({ ...proposedArtist, blurb: event.target.value })}
                      className="min-w-0 flex-1 resize-y border border-stone-300 bg-white/60 px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#9256a8] disabled:opacity-50"
                    />
                    <div className="flex flex-col gap-2">
                      <button type="button" disabled={beforeArtist.is_curated} onClick={() => focusControl("metadata-blurb")} className={iconButtonClass("edit")} aria-label="Edit summary" title="Edit summary">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" disabled={beforeArtist.is_curated} onClick={() => resetMetadataField("blurb")} className={iconButtonClass("remove")} aria-label="Revert summary" title="Revert summary">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </EditableField>
                <EditableField label="City" before={beforeArtist.artist_context?.city}>
                  <div className="flex gap-2">
                    <input
                      id="metadata-city"
                      value={proposedArtist.artist_context?.city ?? ""}
                      disabled={beforeArtist.is_curated}
                      onChange={(event) => updateArtistContext({ city: event.target.value })}
                      className="min-w-0 flex-1 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8] disabled:opacity-50"
                    />
                    <button type="button" disabled={beforeArtist.is_curated} onClick={() => focusControl("metadata-city")} className={iconButtonClass("edit")} aria-label="Edit city" title="Edit city">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={beforeArtist.is_curated} onClick={() => resetMetadataField("city")} className={iconButtonClass("remove")} aria-label="Revert city" title="Revert city">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </EditableField>
                <EditableField label="Years active" before={beforeArtist.artist_context?.yearsActive}>
                  <div className="flex gap-2">
                    <input
                      id="metadata-years-active"
                      value={proposedArtist.artist_context?.yearsActive ?? ""}
                      disabled={beforeArtist.is_curated}
                      onChange={(event) => updateArtistContext({ yearsActive: event.target.value })}
                      className="min-w-0 flex-1 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8] disabled:opacity-50"
                    />
                    <button type="button" disabled={beforeArtist.is_curated} onClick={() => focusControl("metadata-years-active")} className={iconButtonClass("edit")} aria-label="Edit years active" title="Edit years active">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={beforeArtist.is_curated} onClick={() => resetMetadataField("yearsActive")} className={iconButtonClass("remove")} aria-label="Revert years active" title="Revert years active">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </EditableField>
              </>
            ) : (
              <>
                <ChangeRow label="Genres" before={beforeArtist.tags} after={proposedArtist.tags} />
                <ChangeRow label="Summary" before={beforeArtist.blurb} after={proposedArtist.blurb} />
                <ChangeRow label="City" before={beforeArtist.artist_context?.city} after={proposedArtist.artist_context?.city} />
                <ChangeRow label="Years active" before={beforeArtist.artist_context?.yearsActive} after={proposedArtist.artist_context?.yearsActive} />
              </>
            )}
            {refresh.scopes.includes("metadata") ? (
              <EditableField label="Wikipedia" before={beforeArtist.wikipedia_url}>
                <div className="flex gap-2">
                  <input
                    id="metadata-wikipedia-url"
                    value={proposedArtist.wikipedia_url ?? ""}
                    disabled={beforeArtist.is_curated}
                    onChange={(event) => setProposedArtist({
                      ...proposedArtist,
                      wikipedia_url: event.target.value,
                    })}
                    placeholder="https://en.wikipedia.org/wiki/..."
                    className="min-w-0 flex-1 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8] disabled:opacity-50"
                  />
                  <button type="button" disabled={beforeArtist.is_curated} onClick={() => focusControl("metadata-wikipedia-url")} className={iconButtonClass("edit")} aria-label="Edit Wikipedia URL" title="Edit Wikipedia URL">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" disabled={beforeArtist.is_curated} onClick={() => resetMetadataField("wikipediaUrl")} className={iconButtonClass("remove")} aria-label="Revert Wikipedia URL" title="Revert Wikipedia URL">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </EditableField>
            ) : (
              <ChangeRow label="Wikipedia" before={beforeArtist.wikipedia_url} after={proposedArtist.wikipedia_url} />
            )}
            {refresh.scopes.includes("same_vibe") ? (
              <EditableField label="Same vibe" before={beforeArtist.related_artists}>
                <div className="space-y-2">
                  {(proposedArtist.artist_context?.relatedArtists ?? []).map((related, index) => (
                    <div key={index} className="grid gap-2 border border-stone-200 bg-white/40 p-2 sm:grid-cols-[1fr_2fr_auto_auto]">
                      <input
                        id={`related-artist-name-${index}`}
                        value={related.name ?? ""}
                        disabled={beforeArtist.is_curated}
                        aria-label={`Related artist ${index + 1}`}
                        onChange={(event) => {
                          const relatedArtists = [...(proposedArtist.artist_context?.relatedArtists ?? [])]
                          relatedArtists[index] = {
                            name: event.target.value,
                            reason: related.reason ?? "",
                          }
                          setProposedArtist({
                            ...proposedArtist,
                            artist_context: proposedArtist.artist_context
                              ? { ...proposedArtist.artist_context, relatedArtists }
                              : null,
                          })
                        }}
                        className="border border-stone-300 bg-white/70 px-2 py-2 text-sm outline-none focus:border-[#9256a8] disabled:opacity-50"
                      />
                      <input
                        id={`related-artist-reason-${index}`}
                        value={related.reason ?? ""}
                        disabled={beforeArtist.is_curated}
                        aria-label={`Related artist reason ${index + 1}`}
                        onChange={(event) => {
                          const relatedArtists = [...(proposedArtist.artist_context?.relatedArtists ?? [])]
                          relatedArtists[index] = {
                            name: related.name ?? "",
                            reason: event.target.value,
                          }
                          setProposedArtist({
                            ...proposedArtist,
                            artist_context: proposedArtist.artist_context
                              ? { ...proposedArtist.artist_context, relatedArtists }
                              : null,
                          })
                        }}
                        className="border border-stone-300 bg-white/70 px-2 py-2 text-sm outline-none focus:border-[#9256a8] disabled:opacity-50"
                      />
                      <button
                        type="button"
                        disabled={beforeArtist.is_curated}
                        onClick={() => focusControl(`related-artist-name-${index}`)}
                        className={iconButtonClass("edit")}
                        aria-label={`Edit related artist ${index + 1}`}
                        title="Edit related artist"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={beforeArtist.is_curated}
                        onClick={() => {
                          const relatedArtists = (proposedArtist.artist_context?.relatedArtists ?? [])
                            .filter((_, itemIndex) => itemIndex !== index)
                          setProposedArtist({
                            ...proposedArtist,
                            artist_context: proposedArtist.artist_context
                              ? { ...proposedArtist.artist_context, relatedArtists }
                              : null,
                          })
                        }}
                        className={iconButtonClass("remove")}
                        aria-label={`Remove related artist ${index + 1}`}
                        title="Remove related artist"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={beforeArtist.is_curated}
                    onClick={() => setProposedArtist({
                      ...proposedArtist,
                      artist_context: proposedArtist.artist_context
                        ? {
                          ...proposedArtist.artist_context,
                          relatedArtists: [
                            ...proposedArtist.artist_context.relatedArtists,
                            { name: "", reason: "" },
                          ],
                        }
                        : null,
                    })}
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#9256a8] disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add related artist
                  </button>
                </div>
              </EditableField>
            ) : (
              <ChangeRow label="Same vibe" before={beforeArtist.related_artists} after={proposedArtist.related_artists} />
            )}
          </div>

          {refresh.scopes.includes("videos") && (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-3xl tracking-[0.1em]">Video Preview</h2>
                  <p className="mt-1 text-sm text-black/50">Current live videos are shown unchanged. Remove bad generated videos or replace a specific item by URL.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <AddVideoForm
                    onAdd={(video) => {
                      setVideos((current) => [
                        ...current,
                        { ...video, display_order: current.length },
                      ])
                      setManualVideoRemovals((current) =>
                        current.filter((id) => id !== video.youtube_video_id),
                      )
                      setManualVideoReplacements((current) =>
                        current.filter((id) => id !== video.youtube_video_id),
                      )
                    }}
                  />
                  <div className="text-xs uppercase tracking-[0.14em] text-black/40">{videos.length} live videos</div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {videos.map((video, index) => (
                  <VideoPreview
                    key={`${video.youtube_video_id}-${index}`}
                    video={video}
                    isProtectedManual={beforeManualVideoIds.has(video.youtube_video_id)}
                    changeLabel={
                      beforeManualVideoIds.has(video.youtube_video_id)
                        ? "Manual · protected"
                        : video.is_manually_added
                          ? "Manual replacement"
                          : beforeVideoIds.has(video.youtube_video_id)
                            ? "Current generated"
                            : "Replacement"
                    }
                    onRemove={() => {
                      const replacedProtectedVideo = video.is_manually_added
                        && !beforeManualVideoIds.has(video.youtube_video_id)
                        ? protectedManualVideosByReplacementPosition.get(video.display_order)
                        : null
                      setVideos((current) => current.filter((_, itemIndex) => itemIndex !== index))
                      if (beforeManualVideoIds.has(video.youtube_video_id)) {
                        setManualVideoRemovals((current) => [
                          ...new Set([...current, video.youtube_video_id]),
                        ])
                        setManualVideoReplacements((current) =>
                          current.filter((id) => id !== video.youtube_video_id),
                        )
                      } else if (replacedProtectedVideo) {
                        restoreVideo(replacedProtectedVideo)
                      } else if (beforeVideoIds.has(video.youtube_video_id)) {
                        setExplicitVideoRemovals((current) => [
                          ...new Set([...current, video.youtube_video_id]),
                        ])
                      }
                    }}
                    onReplace={(replacement, replacedManualVideoId) => {
                      setVideos((current) => current.map((item, itemIndex) => itemIndex === index ? replacement : item))
                      if (replacedManualVideoId) {
                        setManualVideoReplacements((current) => [
                          ...new Set([...current, replacedManualVideoId]),
                        ])
                        setManualVideoRemovals((current) =>
                          current.filter((id) => id !== replacedManualVideoId),
                        )
                      }
                    }}
                  />
                ))}
              </div>
              {removedVideos.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a33b33]">
                    Generated videos marked for removal
                  </h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {removedVideos.map((video) => (
                      <div
                        key={video.youtube_video_id}
                        className="flex items-start justify-between gap-3 border border-[#a33b33]/25 bg-[#a33b33]/5 p-3 text-sm text-[#82332d]"
                      >
                        <a
                          href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 underline decoration-[#a33b33]/35 underline-offset-2"
                        >
                          {video.title}
                        </a>
                        <button
                          type="button"
                          onClick={() => restoreVideo(video)}
                          className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-[#3580b0]"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {replacedManualVideos.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9256a8]">
                    Protected manual videos that will be replaced
                  </h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {replacedManualVideos.map((video) => (
                      <div key={video.youtube_video_id} className="border border-[#9256a8]/25 bg-[#9256a8]/5 p-3 text-sm text-[#6d3d7c]">
                        {video.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {removedManualVideos.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a33b33]">
                    Protected manual videos marked for removal
                  </h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {removedManualVideos.map((video) => (
                      <div key={video.youtube_video_id} className="flex items-start justify-between gap-3 border border-[#a33b33]/25 bg-[#a33b33]/5 p-3 text-sm text-[#82332d]">
                        <a
                          href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 underline decoration-[#a33b33]/35 underline-offset-2"
                        >
                          {video.title}
                        </a>
                        <button
                          type="button"
                          onClick={() => restoreVideo(video)}
                          className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-[#3580b0]"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-stone-300 pt-6">
            {publishWarnings.map((warning) => <p key={warning} className="mb-3 border border-[#a33b33]/35 bg-[#a33b33]/5 p-3 text-sm text-[#82332d]"><strong>Publish blocked:</strong> {warning}</p>)}
            {hasManualMetadataEdits && (
              <p className="mb-3 border border-[#9256a8]/35 bg-[#9256a8]/5 p-3 text-sm text-[#6d3d7c]">
                <strong>Manual metadata:</strong> Publishing will mark this artist as curated. Future metadata and same-vibe refreshes cannot overwrite it, but video and YouTube metadata refreshes remain available.
              </p>
            )}
            <p className="mb-4 text-sm text-black/55">Publishing applies only the selected scopes. Manually selected videos are marked protected for future refreshes.</p>
            <button type="button" disabled={busy || published || publishWarnings.length > 0} onClick={handlePublish} className="bg-[#d94f43] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-40">
              {busy ? "Publishing..." : published ? "Published" : `Publish ${selectedArtist?.name}`}
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
