import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Video } from "../../types/video"
import { decodeHtml } from "../../utils/decodeHtml"

type Props = {
  videos: Video[]
  onSelect: (video: Video) => void
}

export default function InterviewStrip({ videos, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (videos.length === 0) return null

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.7
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" })
  }

  return (
    <div className="relative -mx-6 bg-[#A6AD3C] py-5">
      <div className="mx-6 mb-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-black/50">
          Interviews
        </div>
      </div>

      <div className="group relative">
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/30 p-1 text-white opacity-0 transition hover:bg-black/50 group-hover:opacity-100"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto px-6 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {videos.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v)}
              className="group/card flex-none text-left"
              style={{ width: "220px" }}
            >
              <div className="relative overflow-hidden">
                <img
                  src={v.thumbnailUrl}
                  alt={v.title}
                  className="aspect-video w-full object-cover transition duration-300 group-hover/card:scale-[1.03]"
                />
                {v.duration && (
                  <span className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    {v.duration}
                  </span>
                )}
              </div>
              <div className="mt-1.5">
                <div className="line-clamp-2 text-[11px] font-semibold leading-tight tracking-[0.01em] text-black/70">
                  {decodeHtml(v.title)}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/30 p-1 text-white opacity-0 transition hover:bg-black/50 group-hover:opacity-100"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
