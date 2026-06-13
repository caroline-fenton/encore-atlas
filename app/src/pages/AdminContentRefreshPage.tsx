import { useCallback, useEffect, useMemo, useState } from "react"
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
    detail: "Genres, summary, location, active years, and Wikipedia source",
  },
  {
    value: "same_vibe",
    label: "Same-vibe artists",
    detail: "Related artist names and reasons",
  },
  {
    value: "videos",
    label: "Live video content",
    detail: "Generated live sets; manual selections remain protected",
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
            <button type="button" onClick={() => setShowReplace((value) => !value)} className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9256a8]">
              {isProtectedManual ? "Replace protected" : "Replace"}
            </button>
            {!video.is_manually_added && (
              <button type="button" onClick={onRemove} className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a33b33]">
                Exclude
              </button>
            )}
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
  const [scopes, setScopes] = useState<RefreshScope[]>(["metadata", "same_vibe", "videos"])
  const [refresh, setRefresh] = useState<ContentRefresh | null>(null)
  const [videos, setVideos] = useState<RefreshVideo[]>([])
  const [manualVideoReplacements, setManualVideoReplacements] = useState<string[]>([])
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
    return warnings
  }, [refresh, videos])
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
    const proposedIds = new Set(videos.map((video) => video.youtube_video_id))
    return refresh?.before_snapshot.videos.filter(
      (video) =>
        (video.video_type ?? "concert") === "concert"
        && !video.is_manually_added
        && !proposedIds.has(video.youtube_video_id),
    ) ?? []
  }, [refresh, videos])
  const replacedManualVideos = useMemo(
    () => refresh?.before_snapshot.videos.filter(
      (video) => manualVideoReplacements.includes(video.youtube_video_id),
    ) ?? [],
    [manualVideoReplacements, refresh],
  )

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
    setManualVideoReplacements([])
    setPublished(false)
    try {
      const result = await generateRefreshPreview(selectedArtist.id, scopes)
      setRefresh(result)
      setVideos(result.proposed_snapshot.videos)
      setManualVideoReplacements([])
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not generate preview")
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish() {
    if (!refresh) return
    setBusy(true)
    setError(null)
    try {
      await publishContentRefresh(refresh.id, videos, manualVideoReplacements)
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
  const proposedArtist = refresh?.proposed_snapshot.artist

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-300 pb-6">
        <div>
          <Link to="/" className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">← Encore Atlas</Link>
          <h1 className="mt-4 font-display text-5xl tracking-[0.12em]">Content Refresh</h1>
          <p className="mt-2 text-sm text-black/55">Preview generated artist changes before publishing.</p>
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
            <button key={artist.id} type="button" onClick={() => { setSelectedArtist(artist); setRefresh(null); setPublished(false) }} className={[
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
              <strong>Curated artist: metadata is locked.</strong> You can preview metadata and same-vibe suggestions, but publishing those scopes is disabled. Manual videos remain protected.
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
            {busy ? "Generating preview..." : "Generate preview"}
          </button>
        </section>
      )}

      {error && <div className="mb-6 border border-[#a33b33]/35 bg-[#a33b33]/5 p-4 text-sm text-[#82332d]">{error}</div>}
      {published && <div className="mb-6 border border-[#5a9a6e]/45 bg-[#5a9a6e]/10 p-4 text-sm text-[#356444]">Refresh published successfully.</div>}

      {refresh && beforeArtist && proposedArtist && (
        <section className="space-y-10 border-t border-stone-300 py-8">
          <div>
            <h2 className="font-display text-3xl tracking-[0.1em]">Metadata Preview</h2>
            <div className="mt-3 grid grid-cols-[10rem_1fr_1fr] gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">
              <span>Field</span><span>Current</span><span>Proposed</span>
            </div>
            <ChangeRow label="Genres" before={beforeArtist.tags} after={proposedArtist.tags} />
            <ChangeRow label="Summary" before={beforeArtist.blurb} after={proposedArtist.blurb} />
            <ChangeRow label="City" before={beforeArtist.artist_context?.city} after={proposedArtist.artist_context?.city} />
            <ChangeRow label="Years active" before={beforeArtist.artist_context?.yearsActive} after={proposedArtist.artist_context?.yearsActive} />
            <ChangeRow label="Wikipedia" before={beforeArtist.wikipedia_url} after={proposedArtist.wikipedia_url} />
            <ChangeRow label="Same vibe" before={beforeArtist.related_artists} after={proposedArtist.related_artists} />
          </div>

          {refresh.scopes.includes("videos") && (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-3xl tracking-[0.1em]">Video Preview</h2>
                  <p className="mt-1 text-sm text-black/50">Exclude generated suggestions. Protected manual selections require explicit replacement confirmation.</p>
                </div>
                <div className="text-xs uppercase tracking-[0.14em] text-black/40">{videos.length} proposed videos</div>
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
                            ? "Generated · retained"
                            : "Generated · will be added"
                    }
                    onRemove={() => setVideos((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    onReplace={(replacement, replacedManualVideoId) => {
                      setVideos((current) => current.map((item, itemIndex) => itemIndex === index ? replacement : item))
                      if (replacedManualVideoId) {
                        setManualVideoReplacements((current) => [
                          ...new Set([...current, replacedManualVideoId]),
                        ])
                      }
                    }}
                  />
                ))}
              </div>
              {removedVideos.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a33b33]">
                    Generated videos that will be removed
                  </h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {removedVideos.map((video) => (
                      <a
                        key={video.youtube_video_id}
                        href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="border border-[#a33b33]/25 bg-[#a33b33]/5 p-3 text-sm text-[#82332d]"
                      >
                        {video.title}
                      </a>
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
            </div>
          )}

          <div className="border-t border-stone-300 pt-6">
            {publishWarnings.map((warning) => <p key={warning} className="mb-3 border border-[#a33b33]/35 bg-[#a33b33]/5 p-3 text-sm text-[#82332d]"><strong>Publish blocked:</strong> {warning}</p>)}
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
