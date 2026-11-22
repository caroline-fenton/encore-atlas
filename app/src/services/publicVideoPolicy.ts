import { getArtistByName } from "./artists"
import type { EnrichResult } from "./youtube"

export type VideoCategory = "concert" | "interview" | "music_video"
export type PublicVideoPolicy = {
  reviewed_empty_types: string[]
  decisions: { youtube_video_id: string; action: string; target_type: string | null }[]
}
export function readVideoPolicy(value: unknown): PublicVideoPolicy {
  const policy = value as Partial<PublicVideoPolicy> | null | undefined
  return { reviewed_empty_types: policy?.reviewed_empty_types ?? [], decisions: policy?.decisions ?? [] }
}

// All browser fallback pages (including pagination and retries) must check the
// artist's current policy. A failed lookup is not permission to show unreviewed
// results; propagate the error so the visitor can retry.
export async function searchWithVideoPolicy(
  artistName: string,
  category: VideoCategory,
  search: () => Promise<EnrichResult>,
): Promise<EnrichResult> {
  const artist = await getArtistByName(artistName, true)
  const policy = readVideoPolicy(artist?.video_curation_policy)
  if (policy.reviewed_empty_types.includes(category)) return { videos: [] }
  const decisions = new Map(policy.decisions.map(d => [d.youtube_video_id, d]))
  const result = await search()
  return { ...result, videos: result.videos.filter(video => {
    const decision = decisions.get(video.id)
    return !decision || (decision.action === "keep" && decision.target_type === category)
  }) }
}
