export type RefreshScope = "metadata" | "same_vibe" | "videos"

export type RefreshVideo = {
  youtube_video_id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  published_at: string | null
  view_count: number | null
  duration: string | null
  search_query: string
  is_manually_added: boolean
  display_order: number
  video_type: string
  channel_title: string | null
}

type EditableArtist = {
  tags: string[] | null
  blurb: string | null
  related_artists: string[] | null
  artist_context: {
    genre: string[]
    city: string | null
    yearsActive: string | null
    sceneSummary: string
    relatedArtists: Array<{ name: string; reason: string }>
    [key: string]: unknown
  } | null
  [key: string]: unknown
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized || null
}

function normalizeTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  )]
}

export function applyManualArtistEdits(
  generated: EditableArtist,
  submitted: EditableArtist,
  scopes: RefreshScope[],
): { artist: EditableArtist; manualMetadataEdit: boolean; errors: string[] } {
  const artist = structuredClone(generated)
  const context = {
    ...(artist.artist_context ?? {
      genre: [],
      city: null,
      yearsActive: null,
      sceneSummary: "",
      relatedArtists: [],
    }),
  }
  let manualMetadataEdit = false
  const errors: string[] = []

  if (scopes.includes("metadata")) {
    manualMetadataEdit = manualMetadataEdit
      || JSON.stringify([
        submitted.tags ?? [],
        submitted.blurb,
        submitted.artist_context?.city ?? null,
        submitted.artist_context?.yearsActive ?? null,
      ])
        !== JSON.stringify([
          generated.tags ?? [],
          generated.blurb,
          generated.artist_context?.city ?? null,
          generated.artist_context?.yearsActive ?? null,
        ])
    const tags = normalizeTextList(submitted.tags)
    const blurb = normalizeText(submitted.blurb)
    const city = normalizeText(submitted.artist_context?.city)
    const yearsActive = normalizeText(submitted.artist_context?.yearsActive)
    if (tags.length === 0) errors.push("Artist metadata requires at least one genre.")
    if (!blurb) errors.push("Artist metadata requires a summary.")

    artist.tags = tags
    artist.blurb = blurb
    context.genre = tags
    context.sceneSummary = blurb ?? ""
    context.city = city
    context.yearsActive = yearsActive
  }

  if (scopes.includes("same_vibe")) {
    manualMetadataEdit = manualMetadataEdit
      || JSON.stringify(submitted.artist_context?.relatedArtists ?? [])
        !== JSON.stringify(generated.artist_context?.relatedArtists ?? [])
    const relatedArtists = Array.isArray(submitted.artist_context?.relatedArtists)
      ? submitted.artist_context.relatedArtists
        .filter((item) => item && typeof item.name === "string")
        .map((item) => ({
          name: item.name.trim(),
          reason: typeof item.reason === "string" ? item.reason.trim() : "",
        }))
        .filter((item) => item.name)
      : []
    if (relatedArtists.length === 0) {
      errors.push("Same-vibe metadata requires at least one related artist.")
    }

    context.relatedArtists = relatedArtists
    artist.related_artists = relatedArtists.map((item) => item.name)
  }

  artist.artist_context = context
  return { artist, manualMetadataEdit, errors }
}

export function parseYouTubeVideoId(value: string): string | null {
  const trimmed = value.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, "")

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0]
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const pathParts = url.pathname.split("/").filter(Boolean)
      const id = url.searchParams.get("v")
        ?? (["embed", "shorts", "live"].includes(pathParts[0] ?? "")
          ? pathParts[1]
          : null)
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }
  } catch {
    return null
  }

  return null
}

export function validatePublishRequest(input: {
  scopes: RefreshScope[]
  isCurated: boolean
  existingVideos: RefreshVideo[]
  proposedVideos: RefreshVideo[]
  manualVideoReplacements: string[]
}): string[] {
  const errors: string[] = []

  if (
    input.isCurated
    && input.scopes.some((scope) => scope === "metadata" || scope === "same_vibe")
  ) {
    errors.push("Curated artist metadata and same-vibe artists are protected.")
  }

  if (input.scopes.includes("videos")) {
    if (input.proposedVideos.length === 0) {
      errors.push("A video refresh cannot publish an empty video list.")
    }

    const proposedIds = new Set(
      input.proposedVideos.map((video) => video.youtube_video_id),
    )
    const replacementIds = new Set(input.manualVideoReplacements)
    const existingManualVideos = input.existingVideos.filter(
      (video) => video.is_manually_added,
    )
    const existingManualIds = new Set(
      existingManualVideos.map((video) => video.youtube_video_id),
    )
    const missingManual = input.existingVideos.some(
      (video) =>
        video.is_manually_added
        && !proposedIds.has(video.youtube_video_id)
        && !replacementIds.has(video.youtube_video_id),
    )
    if (missingManual) {
      errors.push("Manually added videos must be preserved or explicitly replaced.")
    }

    const invalidReplacement = input.manualVideoReplacements.some(
      (id) => !existingManualIds.has(id) || proposedIds.has(id),
    )
    if (invalidReplacement) {
      errors.push("Manual video replacements must identify a removed protected video.")
    }

    const replacementWithoutManualSuccessor = existingManualVideos.some(
      (existing) =>
        replacementIds.has(existing.youtube_video_id)
        && !input.proposedVideos.some(
          (proposed) =>
            proposed.is_manually_added
            && proposed.display_order === existing.display_order,
        ),
    )
    if (replacementWithoutManualSuccessor) {
      errors.push("A protected manual video replacement must remain manual and keep its position.")
    }

    if (proposedIds.size !== input.proposedVideos.length) {
      errors.push("The proposed video list contains duplicates.")
    }
  }

  return errors
}

export function normalizeVideoOrder(
  videos: RefreshVideo[],
  protectedManualPositions: number[] = [],
): RefreshVideo[] {
  const protectedPositions = new Set(protectedManualPositions)
  let nextPosition = 0

  return videos.map((video) => {
    if (
      video.is_manually_added
      && protectedPositions.has(video.display_order)
    ) {
      nextPosition = Math.max(nextPosition, video.display_order + 1)
      return video
    }

    while (protectedPositions.has(nextPosition)) nextPosition += 1
    const normalized = { ...video, display_order: nextPosition }
    nextPosition += 1
    return normalized
  })
}

export function mergeManualVideos(
  generated: RefreshVideo[],
  existing: RefreshVideo[],
): RefreshVideo[] {
  const merged = [...generated]
  const manualVideos = existing
    .filter((video) =>
      (video.video_type ?? "concert") === "concert"
      && video.is_manually_added
    )
    .sort((a, b) => a.display_order - b.display_order)

  for (const manual of manualVideos) {
    const fresh = merged.find(
      (video) => video.youtube_video_id === manual.youtube_video_id,
    )
    const protectedVideo = fresh
      ? {
        ...fresh,
        is_manually_added: true,
        display_order: manual.display_order,
      }
      : manual
    const withoutDuplicate = merged.filter(
      (video) => video.youtube_video_id !== manual.youtube_video_id,
    )
    const index = Math.min(manual.display_order, withoutDuplicate.length)
    withoutDuplicate.splice(index, 0, protectedVideo)
    merged.splice(0, merged.length, ...withoutDuplicate)
  }
  return normalizeVideoOrder(merged)
}

export function concertVideos(videos: RefreshVideo[]): RefreshVideo[] {
  return videos.filter((video) => (video.video_type ?? "concert") === "concert")
}
