type Props = {
  value: string
  className?: string
}

export default function DurationBadge({ value, className = "" }: Props) {
  return (
    <div
      className={[
        "inline-flex items-center rounded-sm border border-black/20 bg-white/70 px-2 py-1 text-xs font-semibold tracking-wide text-black/80",
        className,
      ].join(" ")}
    >
      {value}
    </div>
  )
}
