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
    .select("artist_id,youtube_video_id,title,thumbnail_url,duration,channel_title,display_order")
    .in("artist_id", artists.map((artist) => artist.id))
    .eq("video_type", "concert")
    .order("display_order", { ascending: true })

  if (videosError) throw videosError

  const firstVideoByArtist = new Map<string, NonNullable<SceneArtist["video"]>>()
  for (const video of videos ?? []) {
    if (!firstVideoByArtist.has(video.artist_id)) {
      firstVideoByArtist.set(video.artist_id, {
        youtube_video_id: video.youtube_video_id,
        title: video.title,
        thumbnail_url: video.thumbnail_url,
        duration: video.duration,
        channel_title: video.channel_title,
      })
    }
  }

  const artistByName = new Map(artists.map((artist) => [artist.name, artist]))
  return scene.artistNames.flatMap((name) => {
    const artist = artistByName.get(name)
    if (!artist) return []
    return [{
      ...artist,
      artist_context: artist.artist_context as ArtistContext | null,
      video: firstVideoByArtist.get(artist.id) ?? null,
    }]
  })
}

