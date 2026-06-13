import { useEffect, useState } from "react"
import { ArrowLeft, ArrowUpRight, MapPin, Play } from "lucide-react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { scenes, type SceneDefinition } from "../data/scenes"
import type { AppOutletContext } from "../layouts/AppLayout"
import { getSceneArtists, type SceneArtist } from "../services/scenes"

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function ScenePoster({
  scene,
  onSelect,
}: {
  scene: SceneDefinition
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative min-h-72 overflow-hidden border border-black/20 p-5 text-left shadow-[5px_5px_0_rgba(0,0,0,0.12)] transition hover:-translate-y-1 hover:shadow-[8px_8px_0_rgba(0,0,0,0.15)]"
      style={{ backgroundColor: scene.accent }}
    >
      <div className="pointer-events-none absolute inset-2 border-2 border-white/70" />
      <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full border-[20px] border-black/10" />
      <div className="relative flex h-full flex-col justify-between">
        <div>
          <div className="font-typewriter text-[10px] uppercase tracking-[0.2em] text-black/60">
            {scene.place} · {scene.era}
          </div>
          <h2 className="mt-5 max-w-[13rem] font-display text-5xl leading-[0.88] tracking-[0.04em] text-black/85">
            {scene.name.toUpperCase()}
          </h2>
        </div>
        <div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {scene.artistNames.slice(0, 4).map((artist) => (
              <span key={artist} className="bg-white/70 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-black/65">
                {artist}
              </span>
            ))}
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-black/65 group-hover:text-black">
            Enter scene <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </button>
  )
}

function SceneDetail({
  scene,
  onBack,
}: {
  scene: SceneDefinition
  onBack: () => void
}) {
  const { setSelectedArtist } = useOutletContext<AppOutletContext>()
  const navigate = useNavigate()
  const [artists, setArtists] = useState<SceneArtist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSceneArtists(scene)
      .then((result) => {
        if (!cancelled) setArtists(result)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load this scene")
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [scene])

  function openArtist(artist: SceneArtist) {
    setSelectedArtist({ id: toSlug(artist.name), name: artist.name.toUpperCase() })
    navigate("/")
  }

  return (
    <div className="pb-12">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 py-6 text-xs font-semibold uppercase tracking-[0.18em] text-black/45 hover:text-black/70">
        <ArrowLeft className="h-4 w-4" /> All scenes
      </button>

      <header className="relative overflow-hidden border border-black/20 p-7 shadow-[7px_7px_0_rgba(0,0,0,0.12)] md:p-10" style={{ backgroundColor: scene.accent }}>
        <div className="pointer-events-none absolute inset-3 border-2 border-white/65" />
        <div className="relative max-w-3xl">
          <div className="font-typewriter text-[10px] uppercase tracking-[0.25em] text-black/55">
            Scene file · {scene.era}
          </div>
          <h1 className="mt-5 font-display text-6xl leading-[0.88] tracking-[0.04em] text-black/85 md:text-8xl">
            {scene.name.toUpperCase()}
          </h1>
          <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-black/60">
            <MapPin className="h-4 w-4" /> {scene.place}
          </div>
        </div>
      </header>

      <section className="mt-10 grid gap-8 border-b border-stone-300 pb-10 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="font-typewriter text-[10px] uppercase tracking-[0.22em] text-black/40">The sound</div>
          <p className="mt-3 text-xl leading-relaxed text-black/75">{scene.introduction}</p>
          <p className="mt-5 text-sm leading-relaxed text-black/50">{scene.significance}</p>
        </div>
        <div>
          <div className="font-typewriter text-[10px] uppercase tracking-[0.22em] text-black/40">Scene markers</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {scene.traits.map((trait) => (
              <span key={trait} className="border border-black/20 bg-white/40 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-black/60">
                {trait}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-typewriter text-[10px] uppercase tracking-[0.22em] text-black/40">Existing Atlas artists</div>
            <h2 className="mt-1 font-display text-4xl tracking-[0.08em] text-black/80">WHO WAS THERE</h2>
          </div>
          {!isLoading && <div className="text-xs uppercase tracking-[0.14em] text-black/35">{artists.length} artists</div>}
        </div>

        {isLoading && <div className="mt-5 h-48 animate-pulse border border-stone-200 bg-white/35" />}
        {error && <p className="mt-5 border border-[#a33b33]/25 bg-[#a33b33]/5 p-4 text-sm text-[#82332d]">{error}</p>}

        {!isLoading && !error && (
          artists.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {artists.map((artist, index) => (
                <article key={artist.id} className="group overflow-hidden border border-stone-300 bg-white/35">
                  {artist.video && (
                    <a
                      href={`https://www.youtube.com/watch?v=${artist.video.youtube_video_id}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Watch ${artist.video.title} by ${artist.name} on YouTube`}
                      className="relative block aspect-video overflow-hidden bg-black/10"
                    >
                      <img
                        src={artist.video.thumbnail_url ?? `https://img.youtube.com/vi/${artist.video.youtube_video_id}/hqdefault.jpg`}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                      <span className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center bg-black/75 text-white">
                        <Play className="h-4 w-4 fill-current" />
                      </span>
                      {artist.video.duration && (
                        <span className="absolute bottom-3 right-3 bg-black/75 px-2 py-1 font-mono text-[10px] text-white">{artist.video.duration}</span>
                      )}
                    </a>
                  )}
                  <div className="p-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: scene.accent }}>
                      {String(index + 1).padStart(2, "0")} · Scene artist
                    </div>
                    <h3 className="mt-2 font-display text-3xl tracking-[0.08em] text-black/80">{artist.name.toUpperCase()}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-black/50">
                      {artist.blurb ?? artist.artist_context?.sceneSummary ?? "Explore this artist's place in the scene through their live archive."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {(artist.tags ?? []).slice(0, 4).map((tag) => (
                        <span key={tag} className="text-[9px] font-semibold uppercase tracking-[0.12em] text-black/40">#{tag}</span>
                      ))}
                    </div>
                    <button type="button" onClick={() => openArtist(artist)} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-black/55 hover:text-black">
                      Explore artist <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 border border-stone-300 bg-white/30 p-5 text-sm leading-relaxed text-black/50">
              This scene file is ready, but its artists have not reached the Atlas archive yet.
            </p>
          )
        )}
      </section>
    </div>
  )
}

export default function SceneExplorerPage() {
  const [selectedScene, setSelectedScene] = useState<SceneDefinition | null>(null)

  if (selectedScene) {
    return <SceneDetail scene={selectedScene} onBack={() => setSelectedScene(null)} />
  }

  return (
    <div className="space-y-10 pb-12 pt-10">
      <header className="max-w-3xl">
        <div className="font-typewriter text-[10px] uppercase tracking-[0.3em] text-black/40">A field guide to music history</div>
        <h1 className="mt-3 font-display text-6xl leading-none tracking-[0.08em] text-black/80 md:text-8xl">SCENE EXPLORER</h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-black/55">
          Scenes are more than genres. They are rooms, labels, friendships, rivalries, and a particular moment in a particular place. Start with an existing Atlas artist, then follow the connections.
        </p>
      </header>

      <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((scene) => (
          <ScenePoster key={scene.id} scene={scene} onSelect={() => setSelectedScene(scene)} />
        ))}
      </div>

      <p className="border-t border-stone-300 pt-6 font-typewriter text-[10px] uppercase tracking-[0.2em] text-black/35">
        Built from artists and persisted live performances already in Encore Atlas. More scene files will appear as the archive grows.
      </p>
    </div>
  )
}
