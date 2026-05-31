import { useState, useRef } from "react"
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
      className="group flex-none text-left"
      style={{ width: "160px" }}
    >
      <div className="relative overflow-hidden rounded-sm">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className={[
            "aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.03]",
            isWatched ? "opacity-60" : "",
          ].join(" ")}
        />
        {video.duration && (
          <span className="absolute bottom-1 right-1 bg-black/70 px-1 py-0.5 text-[9px] text-white">
            {video.duration}
          </span>
        )}
        {isWatched && (
          <span className="absolute top-1 left-1 bg-white/20 px-1 py-0.5 text-[8px] uppercase tracking-wider text-white/70">
            Watched
          </span>
        )}
      </div>
      <div className="mt-1">
        <div className="line-clamp-2 text-[10px] leading-tight text-white/60">
          {decodeHtml(video.title)}
        </div>
      </div>
    </button>
  )
}

function HorizontalScroll({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={scrollRef}
      className="flex gap-3 overflow-x-auto"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
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
            <div className="flex gap-2">
              {liveVideos.slice(0, 2).map((v) => (
                <img
                  key={v.id}
                  src={v.thumbnailUrl}
                  alt={v.title}
                  className="h-10 w-16 rounded-sm object-cover opacity-70"
                />
              ))}
              {liveVideos.length > 2 && (
                <span className="flex items-center text-[10px] text-white/30">
                  +{liveVideos.length - 2}
                </span>
              )}
            </div>
          }
        >
          <HorizontalScroll>
            {liveVideos.map((v) => (
              <VideoThumbnail
                key={v.id}
                video={v}
                onSelect={onSelectVideo}
                isWatched={watchedVideoIds.has(v.id)}
              />
            ))}
          </HorizontalScroll>
        </ContentCard>
      )}

      {/* Interviews */}
      {interviewVideos.length > 0 && (
        <ContentCard
          title="Interviews"
          isExpanded={expanded === "interviews"}
          onToggle={() => toggle("interviews")}
          preview={
            <div className="flex gap-2">
              {interviewVideos.slice(0, 2).map((v) => (
                <img
                  key={v.id}
                  src={v.thumbnailUrl}
                  alt={v.title}
                  className="h-10 w-16 rounded-sm object-cover opacity-70"
                />
              ))}
              {interviewVideos.length > 2 && (
                <span className="flex items-center text-[10px] text-white/30">
                  +{interviewVideos.length - 2}
                </span>
              )}
            </div>
          }
        >
          <HorizontalScroll>
            {interviewVideos.map((v) => (
              <VideoThumbnail
                key={v.id}
                video={v}
                onSelect={onSelectVideo}
              />
            ))}
          </HorizontalScroll>
        </ContentCard>
      )}

      {/* Recommended Artists */}
      {relatedArtists.length > 0 && (
        <ContentCard
          title="Recommended Artists"
          isExpanded={expanded === "recommended"}
          onToggle={() => toggle("recommended")}
          preview={
            <div className="text-[10px] text-white/40 truncate">
              {relatedArtists.slice(0, 3).map((a) => a.name).join(", ")}
              {relatedArtists.length > 3 && ` +${relatedArtists.length - 3}`}
            </div>
          }
        >
          <div className="space-y-1.5">
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
                <div className="text-[12px] font-semibold text-white/70 group-hover:text-white transition">
                  {artist.name}
                </div>
                <div className="text-[10px] text-white/30">
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
