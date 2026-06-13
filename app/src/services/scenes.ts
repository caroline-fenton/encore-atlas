import { supabase } from "./supabase"
import type { ArtistContext } from "./artistPage"
import type { SceneDefinition } from "../data/scenes"

export type SceneArtist = {
  id: string
  name: string
  tags: string[] | null
  blurb: string | null
  artist_context: ArtistContext | null
  video: {
    youtube_video_id: string
    title: string
    thumbnail_url: string | null
    duration: string | null
    channel_title: string | null
  } | null
}

type SceneVideoRow = NonNullable<SceneArtist["video"]> & {
  artist_id: string
  display_order: number
  is_manually_added: boolean
}

function titleNamesArtist(title: string, artistName: string): boolean {
  const normalizedTitle = title.toLowerCase()
  const normalizedName = artistName.toLowerCase()
  const names = [normalizedName, normalizedName.replace(/^the /, "")]
  return names.some((name) => name.length > 2 && normalizedTitle.includes(name))
}

export async function getSceneArtists(
  scene: SceneDefinition,
): Promise<SceneArtist[]> {
  const { data: artists, error: artistsError } = await supabase
    .from("artists")
    .select("id,name,tags,blurb,artist_context")
    .in("name", scene.artistNames)

  if (artistsError) throw artistsError
  if (!artists?.length) return []

  const { data: videos, error: videosError } = await supabase
    .from("artist_videos")
    .select("artist_id,youtube_video_id,title,thumbnail_url,duration,channel_title,display_order,is_manually_added")
    .in("artist_id", artists.map((artist) => artist.id))
    .eq("video_type", "concert")
    .order("display_order", { ascending: true })

  if (videosError) throw videosError

  const artistNameById = new Map(artists.map((artist) => [artist.id, artist.name]))
  const representativeVideoByArtist = new Map<string, SceneVideoRow>()
  for (const video of (videos ?? []) as SceneVideoRow[]) {
    const current = representativeVideoByArtist.get(video.artist_id)
    const artistName = artistNameById.get(video.artist_id)
    if (!current || (
      artistName
      && (
        (video.is_manually_added && !current.is_manually_added)
        || (
          video.is_manually_added === current.is_manually_added
          && !titleNamesArtist(current.title, artistName)
          && titleNamesArtist(video.title, artistName)
        )
      )
    )) {
      representativeVideoByArtist.set(video.artist_id, video)
    }
  }

  const artistByName = new Map(artists.map((artist) => [artist.name, artist]))
  return scene.artistNames.flatMap((name) => {
    const artist = artistByName.get(name)
    if (!artist) return []
    return [{
      ...artist,
      artist_context: artist.artist_context as ArtistContext | null,
      video: representativeVideoByArtist.get(artist.id) ?? null,
    }]
  })
}
