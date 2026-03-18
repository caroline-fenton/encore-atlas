type Props = {
  message: string
  onRetry?: () => void
}

export default function ErrorState({ message, onRetry }: Props) {
  return (
    <div className="py-12 text-center">
      <p className="font-typewriter text-sm text-black/55">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center border border-[#7a2d2b] bg-transparent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#7a2d2b] hover:bg-[#7a2d2b]/5"
        >
          Try Again
        </button>
      )}
    </div>
  )
}
