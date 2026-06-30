import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Pencil, Plus, Search, X } from "lucide-react"
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
  type RefreshVideoType,
  type VideoSearchQueries,
} from "../services/adminContentRefresh"
import { ensureSession } from "../services/auth"

const previewScopes: RefreshScope[] = ["metadata", "same_vibe", "videos"]

const videoSections: Array<{
  type: RefreshVideoType
  title: string
  emptyText: string
}> = [
  { type: "concert", title: "Live Videos", emptyText: "No live videos in this preview." },
  { type: "interview", title: "Interviews", emptyText: "No interviews in this preview." },
  { type: "music_video", title: "Music Videos", emptyText: "No music videos in this preview." },
]

function valueText(value: unknown): string {
  if (value == null || value === "") return "Not set"
  if (Array.isArray(value)) return value.join(", ") || "None"
  if (typeof value === "object") {
    const epic = value as Partial<ReturnType<typeof defaultEpicTemplate>>
    if ("enabled" in epic) {
      return [
        epic.enabled ? "Enabled" : "Disabled",
        epic.heroImageUrl,
        epic.tagline,
        epic.featuredEra,
        epic.featuredLiveMoment,
        epic.introCopy,
      ].filter(Boolean).join(" | ") || "Disabled"
    }
    return JSON.stringify(value)
  }
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
      epicTemplate: artist.artist_context?.epicTemplate ?? null,
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

function defaultVideoSearchQueries(artistName: string): Required<VideoSearchQueries> {
  return {
    concert: `${artistName} live concert full set`,
    interview: `${artistName} interview`,
    music_video: `${artistName} official music video`,
  }
}

function videoType(video: Pick<RefreshVideo, "video_type">): RefreshVideoType {
  return video.video_type === "interview" || video.video_type === "music_video"
    ? video.video_type
    : "concert"
}

function videoKey(video: Pick<RefreshVideo, "youtube_video_id" | "video_type">): string {
  return `${videoType(video)}:${video.youtube_video_id}`
}

function videosByType(videos: RefreshVideo[], type: RefreshVideoType) {
  return videos
    .filter((video) => videoType(video) === type)
    .sort((a, b) => a.display_order - b.display_order)
}

function stagePreviewVideos(beforeVideos: RefreshVideo[], proposedVideos: RefreshVideo[]) {
  return videoSections.flatMap(({ type }) => {
    const proposedByKey = new Map(
      videosByType(proposedVideos, type).map((video) => [videoKey(video), video]),
    )
    const staged = videosByType(beforeVideos, type).map((video) => ({
      ...(proposedByKey.get(videoKey(video)) ?? video),
      video_type: type,
      display_order: video.display_order,
    }))
    const stagedKeys = new Set(staged.map(videoKey))
    const additions = videosByType(proposedVideos, type)
      .filter((video) => !stagedKeys.has(videoKey(video)))
      .map((video, index) => ({
        ...video,
        video_type: type,
        display_order: staged.length + index,
      }))

    return [...staged, ...additions]
  })
}

function duplicateVideoKeys(videos: RefreshVideo[]) {
  const counts = new Map<string, number>()
  for (const video of videos) {
    counts.set(video.youtube_video_id, (counts.get(video.youtube_video_id) ?? 0) + 1)
  }
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([youtubeVideoId]) => youtubeVideoId),
  )
}

function hasTargetedSearch(snapshot: ContentRefresh["proposed_snapshot"]) {
  return Boolean(snapshot.video_search_queries)
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

function defaultEpicTemplate() {
  return {
    enabled: false,
    heroImageUrl: null,
    tagline: null,
    featuredEra: null,
    featuredLiveMoment: null,
    introCopy: null,
  }
}

function AddVideoForm({
  videoType,
  onAdd,
}: {
  videoType: RefreshVideoType
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
      const video = await previewReplacementVideo(url, videoType)
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
  videoType,
  changeLabel,
  isProtectedManual,
  isDuplicate,
  onRemove,
  onReplace,
}: {
  video: RefreshVideo
  videoType: RefreshVideoType
  changeLabel: string
  isProtectedManual: boolean
  isDuplicate: boolean
  onRemove: () => void
  onReplace: (video: RefreshVideo, replacedManualVideoKey: string | null) => void
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
      const replacement = await previewReplacementVideo(url, videoType)
      onReplace(
        { ...replacement, video_type: videoType, display_order: video.display_order },
        isProtectedManual ? videoKey(video) : null,
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
    <article className={[
      "border bg-white/35 p-3",
      isDuplicate ? "border-[#a33b33] ring-2 ring-[#a33b33]/15" : "border-stone-300",
    ].join(" ")}>
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
              isDuplicate
                ? "text-[#a33b33]"
                : video.is_manually_added
                  ? "text-[#3580b0]"
                  : "text-black/40",
            ].join(" ")}>
              {isDuplicate ? "Duplicate" : changeLabel}
            </span>
          </div>
          {isDuplicate && (
            <p className="mt-2 border border-[#a33b33]/25 bg-[#a33b33]/5 px-2 py-1 text-xs text-[#82332d]">
              This video appears more than once in this preview.
            </p>
          )}
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
  const [refresh, setRefresh] = useState<ContentRefresh | null>(null)
  const [proposedArtist, setProposedArtist] = useState<RefreshArtist | null>(null)
  const [videos, setVideos] = useState<RefreshVideo[]>([])
  const [explicitVideoRemovals, setExplicitVideoRemovals] = useState<string[]>([])
  const [manualVideoReplacements, setManualVideoReplacements] = useState<string[]>([])
  const [manualVideoRemovals, setManualVideoRemovals] = useState<string[]>([])
  const [showTargetedSearch, setShowTargetedSearch] = useState(false)
  const [videoSearchQueries, setVideoSearchQueries] = useState<Required<VideoSearchQueries>>(
    defaultVideoSearchQueries(""),
  )
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [published, setPublished] = useState(false)
  const previewRequestIdRef = useRef(0)

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
        hasTargetedSearch(refresh.proposed_snapshot)
        ||
        editableVideoSignature(videos) !== editableVideoSignature(refresh.proposed_snapshot.videos)
        || manualVideoReplacements.length > 0
        || manualVideoRemovals.length > 0
      )
    ),
    [manualVideoRemovals.length, manualVideoReplacements.length, refresh, videos],
  )
  const duplicateKeys = useMemo(() => duplicateVideoKeys(videos), [videos])
  const publishWarnings = useMemo(() => {
    const warnings: string[] = []
    if (refresh?.scopes.includes("videos") && videos.length === 0) {
      warnings.push("A video refresh cannot publish an empty video list.")
    }
    if (refresh?.scopes.includes("videos") && duplicateKeys.size > 0) {
      warnings.push("Resolve duplicate videos before publishing.")
    }
    if (
      refresh
      && !hasManualMetadataEdits
      && !hasVideoEdits
    ) {
      warnings.push("Make at least one edit before publishing.")
    }
    return warnings
  }, [duplicateKeys.size, hasManualMetadataEdits, hasVideoEdits, refresh, videos])
  const beforeVideoIds = useMemo(
    () => new Set(
      refresh?.before_snapshot.videos
        .map(videoKey) ?? [],
    ),
    [refresh],
  )
  const beforeManualVideoIds = useMemo(
    () => new Set(
      refresh?.before_snapshot.videos
        .filter((video) => video.is_manually_added)
        .map(videoKey) ?? [],
    ),
    [refresh],
  )
  const removedVideos = useMemo(() => {
    return refresh?.before_snapshot.videos.filter(
      (video) =>
        !video.is_manually_added
        && explicitVideoRemovals.includes(videoKey(video)),
    ) ?? []
  }, [explicitVideoRemovals, refresh])
  const replacedManualVideos = useMemo(
    () => refresh?.before_snapshot.videos.filter(
      (video) => manualVideoReplacements.includes(videoKey(video)),
    ) ?? [],
    [manualVideoReplacements, refresh],
  )
  const removedManualVideos = useMemo(
    () => refresh?.before_snapshot.videos.filter(
      (video) => manualVideoRemovals.includes(videoKey(video)),
    ) ?? [],
    [manualVideoRemovals, refresh],
  )
  const protectedManualVideosByReplacementPosition = useMemo(
    () => new Map(
      refresh?.before_snapshot.videos
        .filter((video) =>
          video.is_manually_added
          && manualVideoReplacements.includes(videoKey(video))
        )
        .map((video) => [`${videoType(video)}:${video.display_order}`, video]) ?? [],
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

  function updateEpicTemplate(
    patch: Partial<NonNullable<NonNullable<RefreshArtist["artist_context"]>["epicTemplate"]>>,
  ) {
    if (!proposedArtist?.artist_context) return
    const epicTemplate = {
      ...defaultEpicTemplate(),
      ...(proposedArtist.artist_context.epicTemplate ?? {}),
      ...patch,
    }
    updateArtistContext({ epicTemplate })
  }

  function resetMetadataField(field: "tags" | "blurb" | "city" | "yearsActive" | "wikipediaUrl" | "epicTemplate") {
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
    if (field === "epicTemplate") {
      updateArtistContext({
        epicTemplate: currentArtist.artist_context?.epicTemplate ?? defaultEpicTemplate(),
      })
      return
    }
    updateArtistContext({ yearsActive: currentArtist.artist_context?.yearsActive ?? null })
  }

  function restoreVideo(video: RefreshVideo) {
    setVideos((current) => {
      if (current.some((item) => videoKey(item) === videoKey(video))) {
        return current
      }
      return [...current, video].sort((a, b) =>
        videoSections.findIndex((section) => section.type === videoType(a))
        - videoSections.findIndex((section) => section.type === videoType(b))
        || a.display_order - b.display_order
      )
    })
    setExplicitVideoRemovals((current) =>
      current.filter((id) => id !== videoKey(video)),
    )
    setManualVideoRemovals((current) =>
      current.filter((id) => id !== videoKey(video)),
    )
    setManualVideoReplacements((current) =>
      current.filter((id) => id !== videoKey(video)),
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

  async function handlePreview(
    artist: AdminArtist,
    targetedQueries?: VideoSearchQueries,
  ) {
    const requestId = previewRequestIdRef.current + 1
    previewRequestIdRef.current = requestId
    setBusy(true)
    setPreviewing(true)
    setError(null)
    setRefresh(null)
    setProposedArtist(null)
    setExplicitVideoRemovals([])
    setManualVideoReplacements([])
    setManualVideoRemovals([])
    setPublished(false)
    try {
      const result = await generateRefreshPreview(
        artist.id,
        previewScopes,
        targetedQueries,
      )
      if (previewRequestIdRef.current !== requestId) return
      setRefresh(result)
      setProposedArtist(result.proposed_snapshot.artist)
      setVideos(
        result.scopes.includes("videos")
          ? hasTargetedSearch(result.proposed_snapshot)
            ? result.proposed_snapshot.videos
            : stagePreviewVideos(
            result.before_snapshot.videos,
            result.proposed_snapshot.videos,
          )
          : result.proposed_snapshot.videos,
      )
      setExplicitVideoRemovals([])
      setManualVideoReplacements([])
      setManualVideoRemovals([])
    } catch (previewError) {
      if (previewRequestIdRef.current !== requestId) return
      setError(previewError instanceof Error ? previewError.message : "Could not generate preview")
    } finally {
      if (previewRequestIdRef.current === requestId) {
        setBusy(false)
        setPreviewing(false)
      }
    }
  }

  function handleSelectArtist(artist: AdminArtist) {
    setSelectedArtist(artist)
    setShowTargetedSearch(false)
    setVideoSearchQueries(defaultVideoSearchQueries(artist.name))
    void handlePreview(artist)
  }

  function updateVideoSearchQuery(type: RefreshVideoType, value: string) {
    setVideoSearchQueries((current) => ({
      ...current,
      [type]: value,
    }))
  }

  function handleTargetedSearchPreview() {
    if (!selectedArtist) return
    const queries = Object.fromEntries(
      Object.entries(videoSearchQueries)
        .map(([type, value]) => [type, value.trim()])
        .filter(([, value]) => value),
    ) as VideoSearchQueries
    void handlePreview(selectedArtist, queries)
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
          <p className="mt-2 text-sm text-black/55">Search an artist to review metadata, same-vibe picks, and every artist-page video category before publishing fixes.</p>
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
            <button key={artist.id} type="button" onClick={() => handleSelectArtist(artist)} className={[
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
              <strong>Curated artist.</strong> Admin edits remain available, and automated public rebuilds cannot overwrite curated metadata.
            </div>
          )}
          {previewing && (
            <div className="mt-5 border border-stone-300 bg-white/30 p-4 text-sm text-black/50">
              Preparing full content preview...
            </div>
          )}
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
                  Left is the current site snapshot. Right is the proposed publish state.
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
                      onChange={(event) => setProposedArtist({
                        ...proposedArtist,
                        tags: event.target.value.split(",").map((tag) => tag.trim()),
                      })}
                      className="min-w-0 flex-1 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8] disabled:opacity-50"
                    />
                    <button type="button" onClick={() => focusControl("metadata-tags")} className={iconButtonClass("edit")} aria-label="Edit genres" title="Edit genres">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => resetMetadataField("tags")} className={iconButtonClass("remove")} aria-label="Revert genres" title="Revert genres">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </EditableField>
                <EditableField label="Summary" before={beforeArtist.blurb}>
                  <div className="flex items-start gap-2">
                    <textarea
                      id="metadata-blurb"
                      value={proposedArtist.blurb ?? ""}
                      rows={5}
                      onChange={(event) => setProposedArtist({ ...proposedArtist, blurb: event.target.value })}
                      className="min-w-0 flex-1 resize-y border border-stone-300 bg-white/60 px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#9256a8] disabled:opacity-50"
                    />
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={() => focusControl("metadata-blurb")} className={iconButtonClass("edit")} aria-label="Edit summary" title="Edit summary">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => resetMetadataField("blurb")} className={iconButtonClass("remove")} aria-label="Revert summary" title="Revert summary">
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
                      onChange={(event) => updateArtistContext({ city: event.target.value })}
                      className="min-w-0 flex-1 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8] disabled:opacity-50"
                    />
                    <button type="button" onClick={() => focusControl("metadata-city")} className={iconButtonClass("edit")} aria-label="Edit city" title="Edit city">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => resetMetadataField("city")} className={iconButtonClass("remove")} aria-label="Revert city" title="Revert city">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </EditableField>
                <EditableField label="Years active" before={beforeArtist.artist_context?.yearsActive}>
                  <div className="flex gap-2">
                    <input
                      id="metadata-years-active"
                      value={proposedArtist.artist_context?.yearsActive ?? ""}
                      onChange={(event) => updateArtistContext({ yearsActive: event.target.value })}
                      className="min-w-0 flex-1 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8] disabled:opacity-50"
                    />
                    <button type="button" onClick={() => focusControl("metadata-years-active")} className={iconButtonClass("edit")} aria-label="Edit years active" title="Edit years active">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => resetMetadataField("yearsActive")} className={iconButtonClass("remove")} aria-label="Revert years active" title="Revert years active">
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
                    onChange={(event) => setProposedArtist({
                      ...proposedArtist,
                      wikipedia_url: event.target.value,
                    })}
                    placeholder="https://en.wikipedia.org/wiki/..."
                    className="min-w-0 flex-1 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8] disabled:opacity-50"
                  />
                  <button type="button" onClick={() => focusControl("metadata-wikipedia-url")} className={iconButtonClass("edit")} aria-label="Edit Wikipedia URL" title="Edit Wikipedia URL">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => resetMetadataField("wikipediaUrl")} className={iconButtonClass("remove")} aria-label="Revert Wikipedia URL" title="Revert Wikipedia URL">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </EditableField>
            ) : (
              <ChangeRow label="Wikipedia" before={beforeArtist.wikipedia_url} after={proposedArtist.wikipedia_url} />
            )}
            {refresh.scopes.includes("metadata") ? (
              <EditableField label="Epic template" before={beforeArtist.artist_context?.epicTemplate}>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 text-sm font-semibold text-black/70">
                    <input
                      type="checkbox"
                      checked={Boolean((proposedArtist.artist_context?.epicTemplate ?? defaultEpicTemplate()).enabled)}
                      onChange={(event) => updateEpicTemplate({ enabled: event.target.checked })}
                      className="h-4 w-4 accent-[#d94f43]"
                    />
                    Enable Epic Artist template
                  </label>
                  <div className="grid gap-3">
                    <input
                      id="epic-hero-image-url"
                      value={(proposedArtist.artist_context?.epicTemplate ?? defaultEpicTemplate()).heroImageUrl ?? ""}
                      onChange={(event) => updateEpicTemplate({ heroImageUrl: event.target.value })}
                      placeholder="Hero/background image URL"
                      className="min-w-0 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8]"
                    />
                    <input
                      value={(proposedArtist.artist_context?.epicTemplate ?? defaultEpicTemplate()).tagline ?? ""}
                      onChange={(event) => updateEpicTemplate({ tagline: event.target.value })}
                      placeholder="Tagline"
                      className="min-w-0 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8]"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={(proposedArtist.artist_context?.epicTemplate ?? defaultEpicTemplate()).featuredEra ?? ""}
                        onChange={(event) => updateEpicTemplate({ featuredEra: event.target.value })}
                        placeholder="Featured era"
                        className="min-w-0 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8]"
                      />
                      <input
                        value={(proposedArtist.artist_context?.epicTemplate ?? defaultEpicTemplate()).featuredLiveMoment ?? ""}
                        onChange={(event) => updateEpicTemplate({ featuredLiveMoment: event.target.value })}
                        placeholder="Featured live moment"
                        className="min-w-0 border border-stone-300 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#9256a8]"
                      />
                    </div>
                    <textarea
                      value={(proposedArtist.artist_context?.epicTemplate ?? defaultEpicTemplate()).introCopy ?? ""}
                      rows={4}
                      onChange={(event) => updateEpicTemplate({ introCopy: event.target.value })}
                      placeholder="Curated intro copy"
                      className="min-w-0 resize-y border border-stone-300 bg-white/60 px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#9256a8]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => focusControl("epic-hero-image-url")} className={iconButtonClass("edit")} aria-label="Edit Epic template image URL" title="Edit Epic template">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => resetMetadataField("epicTemplate")} className={iconButtonClass("remove")} aria-label="Revert Epic template" title="Revert Epic template">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-black/45">
                    Upload curated images to Supabase Storage or another approved host, then paste the URL here. If no image is set, the Epic page falls back to existing artist/video imagery.
                  </p>
                </div>
              </EditableField>
            ) : (
              <ChangeRow label="Epic template" before={beforeArtist.artist_context?.epicTemplate} after={proposedArtist.artist_context?.epicTemplate} />
            )}
            {refresh.scopes.includes("same_vibe") ? (
              <EditableField label="Same vibe" before={beforeArtist.related_artists}>
                <div className="space-y-2">
                  {(proposedArtist.artist_context?.relatedArtists ?? []).map((related, index) => (
                    <div key={index} className="grid gap-2 border border-stone-200 bg-white/40 p-2 sm:grid-cols-[1fr_2fr_auto_auto]">
                      <input
                        id={`related-artist-name-${index}`}
                        value={related.name ?? ""}
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
                        onClick={() => focusControl(`related-artist-name-${index}`)}
                        className={iconButtonClass("edit")}
                        aria-label={`Edit related artist ${index + 1}`}
                        title="Edit related artist"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
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
                  <p className="mt-1 text-sm text-black/50">Current artist-page videos are grouped by section. Remove bad generated videos or replace a specific item by URL.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-black/40">{videos.length} total videos</div>
                  <button
                    type="button"
                    onClick={() => setShowTargetedSearch((value) => !value)}
                    className="inline-flex items-center gap-2 border border-[#3580b0]/35 bg-white/45 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#3580b0] hover:bg-[#3580b0]/5"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Search refresh
                  </button>
                </div>
              </div>
              {hasTargetedSearch(refresh.proposed_snapshot) && (
                <div className="mt-4 border border-[#3580b0]/25 bg-[#3580b0]/5 p-3 text-sm text-[#225b7d]">
                  This preview was rebuilt from targeted YouTube search terms.
                </div>
              )}
              {showTargetedSearch && (
                <div className="mt-5 border border-[#3580b0]/25 bg-white/45 p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {videoSections.map((section) => (
                      <label key={section.type} className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
                          {section.title} query
                        </span>
                        <input
                          value={videoSearchQueries[section.type] ?? ""}
                          onChange={(event) =>
                            updateVideoSearchQuery(section.type, event.target.value)
                          }
                          className="mt-2 w-full border border-stone-300 bg-white/70 px-3 py-2 text-sm outline-none focus:border-[#3580b0]"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={
                        busy
                        || !Object.values(videoSearchQueries).some((value) => value.trim())
                      }
                      onClick={handleTargetedSearchPreview}
                      className="inline-flex items-center gap-2 border border-[#3580b0] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#3580b0] disabled:opacity-40"
                    >
                      <Search className="h-3.5 w-3.5" />
                      {previewing ? "Searching..." : "Preview targeted search"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        selectedArtist
                          ? setVideoSearchQueries(defaultVideoSearchQueries(selectedArtist.name))
                          : undefined
                      }
                      className="text-xs font-semibold uppercase tracking-[0.12em] text-black/45"
                    >
                      Reset queries
                    </button>
                  </div>
                </div>
              )}
              {duplicateKeys.size > 0 && (
                <div className="mt-5 border border-[#a33b33]/35 bg-[#a33b33]/5 p-4 text-sm text-[#82332d]">
                  <strong>Duplicates found.</strong> Remove or replace repeated videos before publishing.
                </div>
              )}
              <div className="mt-6 space-y-10">
                {videoSections.map((section) => {
                  const sectionVideos = videosByType(videos, section.type)
                  return (
                    <section key={section.type} className="border-t border-stone-200 pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-display text-2xl tracking-[0.1em]">{section.title}</h3>
                          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-black/40">
                            {sectionVideos.length} videos
                          </div>
                        </div>
                        <AddVideoForm
                          videoType={section.type}
                          onAdd={(video) => {
                            const typedVideo = {
                              ...video,
                              video_type: section.type,
                              display_order: videosByType(videos, section.type).length,
                            }
                            setVideos((current) => [...current, typedVideo])
                            setManualVideoRemovals((current) =>
                              current.filter((id) => id !== videoKey(typedVideo)),
                            )
                            setManualVideoReplacements((current) =>
                              current.filter((id) => id !== videoKey(typedVideo)),
                            )
                          }}
                        />
                      </div>
                      {sectionVideos.length === 0 ? (
                        <p className="mt-4 border border-stone-200 bg-white/25 p-4 text-sm text-black/45">
                          {section.emptyText}
                        </p>
                      ) : (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {sectionVideos.map((video) => (
                            <VideoPreview
                              key={videoKey(video)}
                              video={video}
                              videoType={section.type}
                              isProtectedManual={beforeManualVideoIds.has(videoKey(video))}
                              isDuplicate={duplicateKeys.has(video.youtube_video_id)}
                              changeLabel={
                                beforeManualVideoIds.has(videoKey(video))
                                  ? "Manual · protected"
                                  : video.is_manually_added
                                    ? "Manual replacement"
                                    : beforeVideoIds.has(videoKey(video))
                                      ? "Current generated"
                                      : "Replacement"
                              }
                              onRemove={() => {
                                const replacedProtectedVideo = video.is_manually_added
                                  && !beforeManualVideoIds.has(videoKey(video))
                                  ? protectedManualVideosByReplacementPosition.get(`${section.type}:${video.display_order}`)
                                  : null
                                setVideos((current) => current.filter((item) => videoKey(item) !== videoKey(video)))
                                if (beforeManualVideoIds.has(videoKey(video))) {
                                  setManualVideoRemovals((current) => [
                                    ...new Set([...current, videoKey(video)]),
                                  ])
                                  setManualVideoReplacements((current) =>
                                    current.filter((id) => id !== videoKey(video)),
                                  )
                                } else if (replacedProtectedVideo) {
                                  restoreVideo(replacedProtectedVideo)
                                } else if (beforeVideoIds.has(videoKey(video))) {
                                  setExplicitVideoRemovals((current) => [
                                    ...new Set([...current, videoKey(video)]),
                                  ])
                                }
                              }}
                              onReplace={(replacement, replacedManualVideoKey) => {
                                setVideos((current) => current.map((item) =>
                                  videoKey(item) === videoKey(video) ? replacement : item
                                ))
                                if (replacedManualVideoKey) {
                                  setManualVideoReplacements((current) => [
                                    ...new Set([...current, replacedManualVideoKey]),
                                  ])
                                  setManualVideoRemovals((current) =>
                                    current.filter((id) => id !== replacedManualVideoKey),
                                  )
                                }
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
              {removedVideos.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a33b33]">
                    Generated videos marked for removal
                  </h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {removedVideos.map((video) => (
                      <div
                        key={videoKey(video)}
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
                      <div key={videoKey(video)} className="border border-[#9256a8]/25 bg-[#9256a8]/5 p-3 text-sm text-[#6d3d7c]">
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
                      <div key={videoKey(video)} className="flex items-start justify-between gap-3 border border-[#a33b33]/25 bg-[#a33b33]/5 p-3 text-sm text-[#82332d]">
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
                <strong>Manual metadata:</strong> Publishing keeps this artist curated so automated public rebuilds cannot overwrite your edits.
              </p>
            )}
            <p className="mb-4 text-sm text-black/55">Publishing applies your edits from this preview. Manually selected videos are marked protected for future refreshes.</p>
            <button type="button" disabled={busy || published || publishWarnings.length > 0} onClick={handlePublish} className="bg-[#d94f43] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-40">
              {busy ? "Publishing..." : published ? "Published" : `Publish ${selectedArtist?.name}`}
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
