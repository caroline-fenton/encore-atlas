import { getMerchForArtist, getCategoryLabel, getStoreLinks } from "../../data/merch"
import type { MerchItem } from "../../types/merch"
import { ExternalLink, ShoppingBag } from "lucide-react"

function FeaturedCard({ item }: { item: MerchItem }) {
  return (
    <a
      href={item.storeUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col overflow-hidden border border-stone-200 bg-white/60 transition hover:border-[#d94f43]/30 hover:shadow-sm"
    >
      <img
        src={item.imageUrl}
        alt={item.name}
        className="h-36 w-full object-cover"
      />
      <div className="p-3 space-y-1.5">
        <div className="inline-flex items-center gap-1.5 bg-[#d94f43]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#d94f43]">
          <ShoppingBag className="h-2.5 w-2.5" />
          Featured
        </div>
        <div className="font-display text-sm tracking-[0.08em] text-black/80 group-hover:text-[#d94f43]">
          {item.name}
        </div>
        {item.description && (
          <p className="font-typewriter text-[11px] text-black/50">{item.description}</p>
        )}
        <div className="flex items-center gap-1 text-[10px] font-typewriter text-black/40">
          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          <span>View on {item.storeName}</span>
        </div>
      </div>
    </a>
  )
}

function ItemCard({ item }: { item: MerchItem }) {
  return (
    <a
      href={item.storeUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex gap-3 border border-stone-200 bg-white/60 p-3 transition hover:border-[#d94f43]/30 hover:shadow-sm"
    >
      <img
        src={item.imageUrl}
        alt={item.name}
        className="h-14 w-14 shrink-0 object-cover"
      />
      <div className="flex min-w-0 flex-col justify-between py-0.5">
        <div className="font-display text-xs tracking-[0.08em] text-black/80 group-hover:text-[#d94f43] leading-snug">
          {item.name}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-typewriter text-black/40">
          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          <span>{item.storeName}</span>
        </div>
      </div>
    </a>
  )
}

type Props = {
  artistId: string
  artistName: string
}

export default function MerchSidebar({ artistId, artistName }: Props) {
  const { featured, byCategory } = getMerchForArtist(artistId)
  const categories = Object.keys(byCategory)
  const stores = getStoreLinks(artistName)
  const hasCuratedMerch = featured || categories.length > 0

  return (
    <div className="space-y-5">
      <div className="font-display text-xl tracking-[0.1em] text-black/80 uppercase">
        Merch
      </div>

      {featured && <FeaturedCard item={featured} />}

      {categories.map((cat) => (
        <div key={cat} className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40">
            {getCategoryLabel(cat)}
          </div>
          <div className="space-y-2">
            {byCategory[cat].map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}

      <div className="space-y-3">
        {stores.map((store, i) => {
          const hoverColor = ["#d94f43", "#4db8e8", "#5a9a6e"][i % 3]
          return (
            <a
              key={store.name}
              href={store.url}
              target="_blank"
              rel="noreferrer"
              className="group block text-black/40 transition"
              onMouseEnter={(e) => { e.currentTarget.style.color = hoverColor }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "" }}
            >
              <span className={hasCuratedMerch
                ? "font-display text-xs tracking-[0.08em]"
                : "text-base font-bold tracking-wide lowercase"
              }>
                {store.name}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
