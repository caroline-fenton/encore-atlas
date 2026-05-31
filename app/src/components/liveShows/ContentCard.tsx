import { ChevronDown } from "lucide-react"

type Props = {
  title: string
  isExpanded: boolean
  onToggle?: () => void
  children: React.ReactNode
  /** Optional preview shown when collapsed */
  preview?: React.ReactNode
  /** Visual variant */
  variant?: "dark" | "cream"
}

export default function ContentCard({
  title,
  isExpanded,
  onToggle,
  children,
  preview,
  variant = "dark",
}: Props) {
  const isDark = variant === "dark"

  return (
    <div
      className={[
        "overflow-hidden transition-all duration-300",
        isDark ? "bg-[#2a2522]" : "bg-[#f6f1e8] border border-stone-200",
      ].join(" ")}
    >
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between px-5 py-4"
        >
          <span
            className={[
              "text-sm font-semibold uppercase tracking-[0.2em]",
              isDark ? "text-white/70" : "text-black/65",
            ].join(" ")}
          >
            {title}
          </span>
          <ChevronDown
            className={[
              "h-4 w-4 transition-transform duration-300",
              isDark ? "text-white/40" : "text-black/30",
              isExpanded ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>
      ) : (
        <div className="px-5 py-4">
          <span
            className={[
              "text-sm font-semibold uppercase tracking-[0.2em]",
              isDark ? "text-white/70" : "text-black/65",
            ].join(" ")}
          >
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
