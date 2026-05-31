import { useState } from "react"
import type { Video } from "../../types/video"
import { decodeHtml } from "../../utils/decodeHtml"
import ContentCard from "./ContentCard"

type RelatedArtist = { name: string; reason: string }

type Props = {
  liveVideos: Video[]
  interviewVideos: Video[]
  relatedArtists: RelatedArtist[]
  onSelectVideo: (video: Video) => void
  onSelectArtist: (artist: { id: string; name: string }) => void
  watchedVideoIds: Set<string>
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function VideoThumbnail({
  video,
  onSelect,
  isWatched,
}: {
  video: Video
  onSelect: (v: Video) => void
  isWatched?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(video)}
      className="group block w-full text-left"
    >
      <div className="relative overflow-hidden">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className={[
            "aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.03]",
            isWatched ? "opacity-60" : "",
          ].join(" ")}
        />
        {video.duration && (
          <span className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
            {video.duration}
          </span>
        )}
        {isWatched && (
          <span className="absolute top-1 left-1 bg-white/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/70">
            Watched
          </span>
        )}
      </div>
      <div className="mt-2">
        <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-white/60">
          {decodeHtml(video.title)}
        </div>
      </div>
    </button>
  )
}

function VideoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  )
}

export default function ContentCards({
  liveVideos,
  interviewVideos,
  relatedArtists,
  onSelectVideo,
  onSelectArtist,
  watchedVideoIds,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>("live")

  const toggle = (card: string) => {
    setExpanded((prev) => (prev === card ? null : card))
  }

  return (
    <div className="space-y-2">
      {/* More Live Sets */}
      {liveVideos.length > 0 && (
        <ContentCard
          title="More Live Sets"
          isExpanded={expanded === "live"}
          onToggle={() => toggle("live")}
          preview={
            <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
              {liveVideos.slice(0, 4).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectVideo(v)
                  }}
                  className="group block text-left"
                >
                  <div className="relative overflow-hidden">
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="aspect-video w-full object-cover opacity-70 transition group-hover:opacity-100"
                    />
                    {v.duration && (
                      <span className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                        {v.duration}
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <div className="line-clamp-1 text-[12px] text-white/50">
                      {decodeHtml(v.title)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          }
        >
          <VideoGrid>
            {liveVideos.map((v) => (
              <VideoThumbnail
                key={v.id}
                video={v}
                onSelect={onSelectVideo}
                isWatched={watchedVideoIds.has(v.id)}
              />
            ))}
          </VideoGrid>
        </ContentCard>
      )}

      {/* Interviews */}
      {interviewVideos.length > 0 && (
        <ContentCard
          title="Interviews"
          isExpanded={expanded === "interviews"}
          onToggle={() => toggle("interviews")}
          preview={
            <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
              {interviewVideos.slice(0, 4).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectVideo(v)
                  }}
                  className="group block text-left"
                >
                  <div className="relative overflow-hidden">
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="aspect-video w-full object-cover opacity-70 transition group-hover:opacity-100"
                    />
                    {v.duration && (
                      <span className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                        {v.duration}
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <div className="line-clamp-1 text-[12px] text-white/50">
                      {decodeHtml(v.title)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          }
        >
          <VideoGrid>
            {interviewVideos.map((v) => (
              <VideoThumbnail
                key={v.id}
                video={v}
                onSelect={onSelectVideo}
              />
            ))}
          </VideoGrid>
        </ContentCard>
      )}

      {/* Recommended Artists */}
      {relatedArtists.length > 0 && (
        <ContentCard
          title="Recommended Artists"
          isExpanded={true}
          variant="cream"
        >
          <div className="space-y-3">
            {relatedArtists.map((artist) => (
              <button
                key={artist.name}
                type="button"
                onClick={() =>
                  onSelectArtist({
                    id: toSlug(artist.name),
                    name: artist.name.toUpperCase(),
                  })
                }
                className="group block w-full text-left"
              >
                <div className="text-sm font-semibold text-black/70 group-hover:text-[#7a2d2b] transition">
                  {artist.name}
                </div>
                <div className="text-[12px] text-black/40">
                  {artist.reason}
                </div>
              </button>
            ))}
          </div>
        </ContentCard>
      )}
    </div>
  )
}
