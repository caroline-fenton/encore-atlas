import { useOutletContext } from "react-router-dom"
import type { AppOutletContext } from "../layouts/AppLayout"
import { getMerchForArtist, getCategoryLabel, getStoreLinks } from "../data/merch"
import type { MerchItem } from "../types/merch"
import { ExternalLink, ShoppingBag } from "lucide-react"

function MerchCard({ item }: { item: MerchItem }) {
  return (
    <a
      href={item.storeUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex gap-4 rounded-sm border border-stone-200 bg-white/60 p-4 transition hover:border-[#7a2d2b]/30 hover:shadow-sm"
    >
      <img
        src={item.imageUrl}
        alt={item.name}
        className="h-24 w-24 rounded-sm object-cover"
      />

      <div className="flex flex-1 flex-col justify-between py-0.5">
        <div>
          <h3 className="font-display text-sm tracking-[0.08em] text-black/80 group-hover:text-[#7a2d2b]">
            {item.name}
          </h3>
          {item.description && (
            <p className="mt-1 font-typewriter text-xs text-black/50">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs font-typewriter text-black/45">
          <ExternalLink className="h-3 w-3" />
          <span>{item.storeName}</span>
        </div>
      </div>
    </a>
  )
}

function FeaturedMerchCard({ item }: { item: MerchItem }) {
  return (
    <a
      href={item.storeUrl}
      target="_blank"
      rel="noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-sm border border-stone-200 bg-white/60 transition hover:border-[#7a2d2b]/30 hover:shadow-sm sm:flex-row"
    >
      <img
        src={item.imageUrl}
        alt={item.name}
        className="h-56 w-full object-cover sm:h-auto sm:w-64"
      />

      <div className="flex flex-1 flex-col justify-between p-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-sm bg-[#7a2d2b]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7a2d2b]">
            <ShoppingBag className="h-3 w-3" />
            Featured
          </div>
          <h3 className="mt-3 font-display text-xl tracking-[0.1em] text-black/80 group-hover:text-[#7a2d2b]">
            {item.name}
          </h3>
          {item.description && (
            <p className="mt-2 font-typewriter text-sm text-black/50">
              {item.description}
            </p>
          )}
        </div>

        <div className="mt-4 inline-flex items-center gap-2 text-xs font-typewriter text-black/45">
          <ExternalLink className="h-3.5 w-3.5" />
          <span>View on {item.storeName}</span>
        </div>
      </div>
    </a>
  )
}

function BrowseStores({ artistName }: { artistName: string }) {
  const stores = getStoreLinks(artistName)

  return (
    <section className="space-y-4">
      <div className="font-display text-2xl tracking-[0.12em] text-black/75 uppercase">
        Browse Stores
      </div>
      <p className="font-typewriter text-xs text-black/50">
        Find merch across these stores — availability varies by artist.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stores.map((store) => (
          <a
            key={store.name}
            href={store.url}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center justify-between rounded-sm border border-stone-200 bg-white/60 px-5 py-4 transition hover:border-[#7a2d2b]/30 hover:shadow-sm"
          >
            <span className="font-display text-sm tracking-[0.08em] text-black/70 group-hover:text-[#7a2d2b]">
              {store.name}
            </span>
            <ExternalLink className="h-4 w-4 text-black/30 group-hover:text-[#7a2d2b]" />
          </a>
        ))}
      </div>
    </section>
  )
}

export default function MerchPage() {
  const { selectedArtistId, selectedArtistName } =
    useOutletContext<AppOutletContext>()

  const { featured, byCategory, hasCuratedItems } =
    getMerchForArtist(selectedArtistId)
  const categories = Object.keys(byCategory)

  return (
    <div className="space-y-8 pb-10">
      <header className="text-center">
        <h1 className="font-display text-5xl md:text-6xl font-normal tracking-[0.22em] leading-none text-black/80 uppercase">
          {selectedArtistName}
        </h1>
        <div className="mt-3 font-typewriter text-xs uppercase tracking-[0.35em] text-black/55">
          Official Merch
        </div>
      </header>

      {featured && (
        <section className="space-y-4">
          <FeaturedMerchCard item={featured} />
        </section>
      )}

      {categories.map((cat) => (
        <section key={cat} className="space-y-4">
          <div className="font-display text-2xl tracking-[0.12em] text-black/75 uppercase">
            {getCategoryLabel(cat)}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {byCategory[cat].map((item) => (
              <MerchCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}

      {hasCuratedItems && (
        <hr className="border-stone-200" />
      )}

      <BrowseStores artistName={selectedArtistName} />
    </div>
  )
}
