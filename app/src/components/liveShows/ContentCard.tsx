import { ChevronDown } from "lucide-react"

type Props = {
  title: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
  /** Optional preview shown when collapsed */
  preview?: React.ReactNode
}

export default function ContentCard({
  title,
  isExpanded,
  onToggle,
  children,
  preview,
}: Props) {
  return (
    <div className="overflow-hidden bg-[#2a2522] transition-all duration-300">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          {title}
        </span>
        <ChevronDown
          className={[
            "h-3.5 w-3.5 text-white/40 transition-transform duration-300",
            isExpanded ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {!isExpanded && preview && (
        <div className="px-4 pb-3">{preview}</div>
      )}

      <div
        className={[
          "transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
        style={{ overflow: isExpanded ? "visible" : "hidden" }}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}
