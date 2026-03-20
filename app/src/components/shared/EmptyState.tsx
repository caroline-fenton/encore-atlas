type Props = {
  message?: string
}

export default function EmptyState({
  message = "No videos found. Try searching for a different artist.",
}: Props) {
  return (
    <div className="py-12 text-center">
      <p className="font-typewriter text-sm text-black/45">{message}</p>
    </div>
  )
}
