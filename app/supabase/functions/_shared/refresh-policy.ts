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
    const missingManual = input.existingVideos.some(
      (video) => video.is_manually_added && !proposedIds.has(video.youtube_video_id),
    )
    if (missingManual) {
      errors.push("Manually added videos must be preserved.")
    }

    if (proposedIds.size !== input.proposedVideos.length) {
      errors.push("The proposed video list contains duplicates.")
    }
  }

  return errors
}

export function normalizeVideoOrder(videos: RefreshVideo[]): RefreshVideo[] {
  return videos.map((video, display_order) => ({ ...video, display_order }))
}
