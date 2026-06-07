import { ChevronDown } from "lucide-react"

type Props = {
  title: string
  isExpanded: boolean
  onToggle?: () => void
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
    <div className="overflow-hidden border border-stone-200 transition-all duration-300">
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between px-5 py-4"
        >
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-black/65">
            {title}
          </span>
          <ChevronDown
            className={[
              "h-4 w-4 transition-transform duration-300 text-black/30",
              isExpanded ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>
      ) : (
        <div className="px-5 py-4">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-black/65">
            {title}
          </span>
        </div>
      )}

      {!isExpanded && preview && (
        <div className="px-5 pb-4">{preview}</div>
      )}

      <div
        className={[
          "transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
        style={{ overflow: isExpanded ? "visible" : "hidden" }}
      >
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  )
}
