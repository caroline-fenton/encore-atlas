import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getAdminSession, invoke, searchAdminArtists, type AdminArtist, type RefreshVideo } from "../services/adminContentRefresh"
import examples from "../../docs/video-curation-approved-examples.json"

const labels: Record<string, string> = { concert: "Live Performances", music_video: "Music Videos", interview: "Interviews & Films" }
type Review = { id: string; artist_id: string; youtube_video_id: string; action: string; target_type: string | null; reason: string; status: string; before_videos: RefreshVideo[]; source_videos: RefreshVideo[]; artists: { name: string }; error_message: string | null }
type Decision = { youtube_video_id: string; action: string; target_type: string | null; video_curation_reviews: { before_videos: RefreshVideo[]; source_videos: RefreshVideo[] } }
type Candidate = { artist: AdminArtist; video: RefreshVideo; categories: string[]; protection?: string; decision: string; reason: string }
const key = (c: Candidate) => `${c.artist.id}:${c.video.youtube_video_id}`
const button = "rounded border border-white/30 px-3 py-2 disabled:opacity-40 hover:bg-white/10"

export default function AdminVideoReviewPage() {
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [query, setQuery] = useState("")
  const [artists, setArtists] = useState<AdminArtist[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [more, setMore] = useState(false)

  async function loadReviews(offset = 0) {
    const data = await invoke<{ reviews: Review[] }>("curation_list", { offset })
    setReviews(old => offset ? [...old, ...data.reviews] : data.reviews)
    setMore(data.reviews.length === 50)
  }
  useEffect(() => {
    let active = true
    getAdminSession().then(async session => {
      if (!active) return
      setAdmin(session.is_admin)
      if (session.is_admin) await loadReviews()
    }).catch(error => { if (active) { setAdmin(false); setMessage(error.message) } })
    return () => { active = false }
  }, [])

  async function run(work: () => Promise<void>) {
    setBusy(true); setMessage("")
    try { await work() } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed") }
    finally { setBusy(false) }
  }
  async function fetchCandidates(artist: AdminArtist): Promise<Candidate[]> {
    const data = await invoke<{ videos: RefreshVideo[]; decisions: Decision[] }>("curation_candidates", { artist_id: artist.id })
    const groups = new Map<string, RefreshVideo[]>()
    for (const v of data.videos) groups.set(v.youtube_video_id, [...(groups.get(v.youtube_video_id) ?? []), v])
    for (const d of data.decisions) {
      if (!groups.has(d.youtube_video_id)) groups.set(d.youtube_video_id, d.video_curation_reviews.source_videos)
    }
    return [...groups].filter(([, rows]) => rows.length).map(([id, rows]) => {
      const d = data.decisions.find(d => d.youtube_video_id === id)
      return { artist, video: rows[0], categories: d?.action === "remove" ? [] : [...new Set(rows.map(v => v.video_type))],
        protection: d ? (d.action === "remove" ? "Excluded from rediscovery" : "Approved and protected") : rows.some(v => v.is_manually_added) ? "Legacy manual pick — available for review" : undefined,
        decision: "skip", reason: "" }
    })
  }
  function edit(id: string, patch: Partial<Candidate>) {
    setCandidates(old => old.map(c => key(c) === id ? { ...c, ...patch } : c))
  }
  async function loadExamples() {
    const loaded = new Map<string, Candidate[]>()
    const next: Candidate[] = []
    const missing: string[] = []
    for (const example of examples.examples) {
      if (!loaded.has(example.artist)) {
        const matches = (await searchAdminArtists(example.artist)).filter(a => a.name.toLowerCase() === example.artist)
        if (matches.length !== 1) throw new Error(`Could not uniquely match ${example.artist}`)
        loaded.set(example.artist, await fetchCandidates(matches[0]))
      }
      const found = loaded.get(example.artist)!.find(c => c.video.youtube_video_id === example.youtube_video_id)
      if (!found) { missing.push(example.title); continue }
      next.push({ ...found, decision: example.decision === "remove" ? "remove" : example.target_video_type!, reason: example.reason })
    }
    setCandidates(next)
    setMessage(missing.length ? `Not found in stored content: ${missing.join("; ")}. No changes applied.` : "Loaded the eight agreed examples. Check the saved previews before applying.")
  }
  async function savePreviews() {
    const chosen = candidates.filter(c => c.decision !== "skip")
    if (!chosen.length || chosen.length > 100 || chosen.some(c => !c.reason.trim())) throw new Error("Select 1–100 decisions and give each a reason")
    const saved: string[] = []
    const failures: string[] = []
    for (const c of chosen) {
      try {
        await invoke("curation_preview", { artist_id: c.artist.id, youtube_video_id: c.video.youtube_video_id,
          decision: c.decision === "remove" ? "remove" : "keep", target_type: c.decision === "remove" ? null : c.decision, reason: c.reason })
        saved.push(key(c))
      } catch (error) { failures.push(`${c.video.title}: ${error instanceof Error ? error.message : "Failed"}`) }
    }
    setCandidates(old => old.map(c => saved.includes(key(c)) ? { ...c, decision: "skip" } : c))
    await loadReviews(); setSelected([])
    setMessage(`${saved.length} previews saved. ${failures.join("; ")}`)
  }
  async function act(action: "approve" | "apply") {
    const wanted = reviews.filter(r => selected.includes(r.id) && r.status === (action === "approve" ? "preview" : "approved"))
    if (!wanted.length) throw new Error(`Select ${action === "approve" ? "preview" : "approved"} rows first`)
    const data = await invoke<{ results?: { status: string; error?: string }[] }>(`curation_${action}`, { ids: wanted.map(r => r.id) })
    await loadReviews(); setSelected([])
    if (action === "apply") setCandidates([])
    setMessage(action === "approve" ? `${wanted.length} decisions approved; ready to apply.` : (data.results ?? []).map(r => r.error ?? r.status).join(" · "))
  }
  if (admin === null) return <main className="p-8">Checking admin access…</main>
  if (!admin) return <main className="p-8"><p>Sign in with your admin account to review videos.</p><Link to="/admin/content-refresh">Go to admin sign-in</Link><p role="alert">{message}</p></main>
  return <main className="mx-auto min-h-screen max-w-5xl space-y-6 bg-zinc-950 p-6 text-white">
    <Link className="underline" to="/admin/content-refresh">← Content Refresh</Link>
    <h1 className="text-4xl">Video Review</h1>
    <p>Keep complete performances, meaningful music videos, and interviews or films about the artist. Tiny Desk, KEXP and TV performances belong in Live Performances. Exclude audio-only uploads, teasers and unrelated performers.</p>
    <p className="text-sm text-white/60">Approved picks are protected. Removed videos stay excluded for this artist. Older manual picks can still be reviewed. Saving a preview does not change public pages.</p>
    <div role="status" aria-live="polite" className="whitespace-pre-wrap">{message}</div>
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
      <button className={button} onClick={() => run(loadExamples)}>Load eight agreed examples</button>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void run(async () => setArtists(await searchAdminArtists(query))) }}>
        <input aria-label="Artist name" className="rounded border p-2" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find an artist" required />
        <button className={button}>Search</button>
      </form>
      <div className="flex flex-wrap gap-2">{artists.map(a => <button className={button} key={a.id} onClick={() => run(async () => setCandidates(await fetchCandidates(a)))}>{a.name}</button>)}</div>
      {candidates.map(c => <article key={key(c)} className="space-y-2 rounded border border-white/20 p-4">
        <p className="text-sm text-white/60">{c.artist.name} · {c.categories.map(t => labels[t] ?? t).join(", ") || "Excluded"}</p>
        <div className="flex gap-3">{c.video.thumbnail_url && <img className="w-32 rounded object-cover" src={c.video.thumbnail_url} alt="" loading="lazy" />}<a className="underline" href={`https://www.youtube.com/watch?v=${c.video.youtube_video_id}`} target="_blank" rel="noreferrer">{c.video.title}</a></div>
        <p className="text-sm text-white/60">{c.video.channel_title} · {c.video.duration ?? "Duration unavailable"}</p>
        {c.video.description && <details><summary>Stored description</summary><p className="whitespace-pre-wrap text-sm">{c.video.description}</p></details>}
        <p className="text-sm">{c.protection}</p>
        <label className="block">Decision <select className="ml-2 rounded bg-zinc-900 p-2" value={c.decision} onChange={e => edit(key(c), { decision: e.target.value })}>
          <option value="skip">Leave unchanged</option>{Object.entries(labels).map(([id, label]) => <option key={id} value={id}>Keep once in {label}</option>)}<option value="remove">Remove and exclude for this artist</option>
        </select></label>
        {c.decision !== "skip" && <label className="block">Reason<textarea className="block w-full rounded border p-2" maxLength={2000} value={c.reason} onChange={e => edit(key(c), { reason: e.target.value })} /></label>}
      </article>)}
      {!!candidates.length && <button className={button} onClick={() => run(savePreviews)}>Save selected previews</button>}
      <h2 className="text-2xl">Saved reviews</h2>
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={() => setSelected(reviews.filter(r => r.status === "preview").map(r => r.id))}>Select previews</button>
        <button className={button} onClick={() => setSelected(reviews.filter(r => r.status === "approved").map(r => r.id))}>Select approved</button>
        <button className={button} onClick={() => setSelected([])}>Clear selection</button>
        <button className={button} onClick={() => run(async () => {
          await invoke("curation_dismiss", { ids: selected }); await loadReviews(); setSelected([])
          setMessage("Selected pending reviews dismissed. Public content is unchanged.")
        })}>Dismiss selected</button>
        <button className={button} onClick={() => run(() => act("approve"))}>Approve selected previews</button>
        <button className={button} onClick={() => run(() => act("apply"))}>Apply selected approvals</button>
      </div>
      {reviews.map(r => <article key={r.id} className="rounded border border-white/20 p-4">
        <label className="flex gap-3"><input type="checkbox" checked={selected.includes(r.id)} disabled={!['preview','approved'].includes(r.status)} onChange={e => setSelected(old => e.target.checked ? [...old, r.id] : old.filter(id => id !== r.id))} />
          <span>{r.artists.name} · {r.source_videos[0]?.title ?? r.youtube_video_id}<br />
            <strong>{r.action === "remove" ? "Remove and exclude" : `Keep once in ${labels[r.target_type!]}`}</strong> · {r.status}</span></label>
        <p className="mt-2 text-sm">Current at preview: {r.before_videos.map(v => labels[v.video_type]).join(", ") || "excluded"}. {r.reason}</p>
        {r.error_message && <p role="alert">{r.error_message}</p>}
      </article>)}
      {more && <button className={button} onClick={() => run(() => loadReviews(reviews.length))}>Load older reviews</button>}
    </fieldset>
  </main>
}
