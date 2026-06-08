import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Video } from "../../types/video"
import { decodeHtml } from "../../utils/decodeHtml"
import DecadeFilter from "../shared/DecadeFilter"

type Props = {
  liveVideos: Video[]
  interviewVideos: Video[]
  musicVideos: Video[]
  onSelectVideo: (video: Video) => void
  watchedVideoIds: Set<string>
  allVideos: Video[]
  selectedDecade: string | null
  onSelectDecade: (decade: string | null) => void
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
}

function CardStrip({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.7
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    })
  }

  return (
    <div>
      {/* Dark accent bar */}
      <div className="h-1 bg-black/80" />

      <div className="flex items-center justify-between pt-4 pb-3">
        <h3 className="font-display text-xl tracking-[0.1em] text-black/80 uppercase">
          {title}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => scroll("left")}
            className="grid h-8 w-8 place-items-center text-black/30 transition hover:text-black/70"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            className="grid h-8 w-8 place-items-center text-black/30 transition hover:text-black/70"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
    </div>
  )
}

function VideoCard({
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
      style={{ width: "260px" }}
    >
      <div className="relative h-[146px] overflow-hidden">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className={[
            "h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]",
            isWatched ? "opacity-50" : "",
          ].join(" ")}
        />
        {video.duration && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/75 px-1.5 py-0.5 text-[10px] text-white">
            {video.duration}
          </span>
        )}
        {isWatched && (
          <span className="absolute top-1.5 left-1.5 bg-black/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white">
            Watched
          </span>
        )}
      </div>
      <div className="mt-2.5">
        <div className="line-clamp-2 text-sm font-semibold leading-snug text-black/80">
          {decodeHtml(video.title)}
        </div>
        {video.channelTitle && (
          <div className="mt-0.5 text-[11px] text-black/40">
            {video.channelTitle}
          </div>
        )}
      </div>
    </button>
  )
}

export default function ContentCards({
  liveVideos,
  interviewVideos,
  musicVideos,
  onSelectVideo,
  watchedVideoIds,
  allVideos,
  selectedDecade,
  onSelectDecade,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: Props) {
  return (
    <div className="space-y-10">
      {/* More Live Sets — always show if there are videos or a decade filter */}
      {(liveVideos.length > 0 || allVideos.length > 1 || hasMore) && (
        <div className="space-y-4">
          {liveVideos.length > 0 ? (
            <CardStrip title="More Live Sets">
              {liveVideos.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onSelect={onSelectVideo}
                  isWatched={watchedVideoIds.has(v.id)}
                />
              ))}
            </CardStrip>
          ) : (
            <div>
              <div className="h-1 bg-black/80" />
              <h3 className="font-display text-xl tracking-[0.1em] text-black/80 uppercase pt-4 pb-3">
                More Live Sets
              </h3>
              <p className="text-sm text-black/40">No sets from this decade.</p>
            </div>
          )}

          {allVideos.length > 0 && (
            <DecadeFilter
              videos={allVideos}
              selected={selectedDecade}
              onSelect={onSelectDecade}
            />
          )}

          {hasMore && onLoadMore && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 border border-stone-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/60 hover:text-black/80 disabled:opacity-50"
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Interviews */}
      {interviewVideos.length > 0 && (
        <CardStrip title="Interviews">
          {interviewVideos.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              onSelect={onSelectVideo}
            />
          ))}
        </CardStrip>
      )}

      {/* Music Videos */}
      {musicVideos.length > 0 && (
        <CardStrip title="Music Videos">
          {musicVideos.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              onSelect={onSelectVideo}
            />
          ))}
        </CardStrip>
      )}
    </div>
  )
}
