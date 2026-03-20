import type { MerchItem, StoreLink } from "../types/merch"

// ─── Store link generators ──────────────────────────────────
// Priority order: Bandcamp → Amazon → Redbubble
// We use search URLs so every artist gets working links.

export function getStoreLinks(artistName: string): StoreLink[] {
  const q = encodeURIComponent(artistName)
  return [
    {
      name: "Bandcamp",
      url: `https://bandcamp.com/search?q=${q}`,
      priority: 1,
    },
    {
      name: "Amazon",
      url: `https://www.amazon.com/s?k=${encodeURIComponent(artistName + " merch")}`,
      priority: 2,
    },
    {
      name: "Redbubble",
      url: `https://www.redbubble.com/shop/?query=${q}&ref=search_box`,
      priority: 3,
    },
  ]
}

// ─── Category helpers ───────────────────────────────────────

const categoryLabels: Record<string, string> = {
  vinyl: "Vinyl & Records",
  apparel: "Apparel",
  poster: "Prints & Posters",
  "box-set": "Box Sets",
  book: "Books",
  accessory: "Accessories",
}

export function getCategoryLabel(category: string): string {
  return categoryLabels[category] ?? category
}

// Map categories → preferred store for curated item links
function storeForCategory(
  category: string,
  artistName: string,
): { storeName: string; storeUrl: string } {
  const q = encodeURIComponent(artistName)
  switch (category) {
    case "vinyl":
    case "box-set":
      return {
        storeName: "Bandcamp",
        storeUrl: `https://bandcamp.com/search?q=${q}`,
      }
    case "book":
      return {
        storeName: "Amazon",
        storeUrl: `https://www.amazon.com/s?k=${encodeURIComponent(artistName + " book")}`,
      }
    case "apparel":
    case "poster":
    case "accessory":
    default:
      return {
        storeName: "Redbubble",
        storeUrl: `https://www.redbubble.com/shop/?query=${q}&ref=search_box`,
      }
  }
}

// ─── Curated merch data ─────────────────────────────────────
// Hand-picked items for known artists. Store links are generated
// from the category → store mapping so they always resolve.

function curatedItem(
  item: Omit<MerchItem, "storeUrl" | "storeName">,
  artistName: string,
): MerchItem {
  const { storeName, storeUrl } = storeForCategory(item.category, artistName)
  return { ...item, storeName, storeUrl }
}

export const merchItems: MerchItem[] = [
  // ── The Smiths ────────────────────────────────────────────
  curatedItem(
    {
      id: "smiths-vinyl-queen",
      artistId: "the-smiths",
      name: "The Queen Is Dead (Remastered)",
      category: "vinyl",
      description: "180g remastered vinyl reissue",
      imageUrl:
        "https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80",
      isFeatured: true,
    },
    "The Smiths",
  ),
  curatedItem(
    {
      id: "smiths-vinyl-meat",
      artistId: "the-smiths",
      name: "Meat Is Murder",
      category: "vinyl",
      description: "Original pressing reissue on 180g vinyl",
      imageUrl:
        "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?auto=format&fit=crop&w=600&q=80",
    },
    "The Smiths",
  ),
  curatedItem(
    {
      id: "smiths-tee-charming",
      artistId: "the-smiths",
      name: "Charming Man Tee",
      category: "apparel",
      description: "Black cotton tee with classic artwork",
      imageUrl:
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80",
    },
    "The Smiths",
  ),
  curatedItem(
    {
      id: "smiths-poster-salford",
      artistId: "the-smiths",
      name: "Salford Lads Club Print",
      category: "poster",
      description: "High-quality archival giclée print",
      imageUrl:
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=600&q=80",
    },
    "The Smiths",
  ),
  curatedItem(
    {
      id: "smiths-box-complete",
      artistId: "the-smiths",
      name: "Complete Studio Albums Box Set",
      category: "box-set",
      description: "8-LP box set with booklet",
      imageUrl:
        "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80",
    },
    "The Smiths",
  ),

  // ── Joy Division ──────────────────────────────────────────
  curatedItem(
    {
      id: "jd-vinyl-unknown",
      artistId: "joy-division",
      name: "Unknown Pleasures",
      category: "vinyl",
      description: "180g remastered vinyl",
      imageUrl:
        "https://images.unsplash.com/photo-1619983081563-430f63602796?auto=format&fit=crop&w=600&q=80",
      isFeatured: true,
    },
    "Joy Division",
  ),
  curatedItem(
    {
      id: "jd-vinyl-closer",
      artistId: "joy-division",
      name: "Closer",
      category: "vinyl",
      description: "Remastered 180g pressing",
      imageUrl:
        "https://images.unsplash.com/photo-1629276301820-0f3f2ff0a388?auto=format&fit=crop&w=600&q=80",
    },
    "Joy Division",
  ),
  curatedItem(
    {
      id: "jd-tee-pleasures",
      artistId: "joy-division",
      name: "Unknown Pleasures Tee",
      category: "apparel",
      description: "Iconic waveform design on black cotton",
      imageUrl:
        "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80",
    },
    "Joy Division",
  ),
  curatedItem(
    {
      id: "jd-book-torn",
      artistId: "joy-division",
      name: "Torn Apart: The Life of Ian Curtis",
      category: "book",
      description: "Biography by Mick Middles & Lindsay Reade",
      imageUrl:
        "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80",
    },
    "Joy Division",
  ),
  curatedItem(
    {
      id: "jd-poster-transmission",
      artistId: "joy-division",
      name: "Transmission Gig Poster",
      category: "poster",
      description: "Reproduction of original concert poster",
      imageUrl:
        "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=600&q=80",
    },
    "Joy Division",
  ),

  // ── Talking Heads ─────────────────────────────────────────
  curatedItem(
    {
      id: "th-vinyl-remain",
      artistId: "talking-heads",
      name: "Remain in Light",
      category: "vinyl",
      description: "Remastered vinyl reissue",
      imageUrl:
        "https://images.unsplash.com/photo-1598488035139-bdbb2231cb64?auto=format&fit=crop&w=600&q=80",
      isFeatured: true,
    },
    "Talking Heads",
  ),
  curatedItem(
    {
      id: "th-vinyl-buildings",
      artistId: "talking-heads",
      name: "More Songs About Buildings and Food",
      category: "vinyl",
      description: "140g vinyl pressing",
      imageUrl:
        "https://images.unsplash.com/photo-1496293455970-f8581aae0e3b?auto=format&fit=crop&w=600&q=80",
    },
    "Talking Heads",
  ),
  curatedItem(
    {
      id: "th-tee-psycho",
      artistId: "talking-heads",
      name: "Psycho Killer Tee",
      category: "apparel",
      description: "Vintage-style graphic tee",
      imageUrl:
        "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=600&q=80",
    },
    "Talking Heads",
  ),
  curatedItem(
    {
      id: "th-book-byrne",
      artistId: "talking-heads",
      name: "How Music Works",
      category: "book",
      description: "By David Byrne",
      imageUrl:
        "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80",
    },
    "Talking Heads",
  ),
  curatedItem(
    {
      id: "th-poster-stop",
      artistId: "talking-heads",
      name: "Stop Making Sense Poster",
      category: "poster",
      description: "Official theatrical reissue poster",
      imageUrl:
        "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=600&q=80",
    },
    "Talking Heads",
  ),

  // ── Pixies ────────────────────────────────────────────────
  curatedItem(
    {
      id: "pixies-vinyl-doolittle",
      artistId: "pixies",
      name: "Doolittle",
      category: "vinyl",
      description: "Remastered vinyl on 4AD",
      imageUrl:
        "https://images.unsplash.com/photo-1621600411688-4be93cd68504?auto=format&fit=crop&w=600&q=80",
      isFeatured: true,
    },
    "Pixies",
  ),
  curatedItem(
    {
      id: "pixies-vinyl-surfer",
      artistId: "pixies",
      name: "Surfer Rosa",
      category: "vinyl",
      description: "Original 4AD pressing reissue",
      imageUrl:
        "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&w=600&q=80",
    },
    "Pixies",
  ),
  curatedItem(
    {
      id: "pixies-tee-monkey",
      artistId: "pixies",
      name: "Monkey Gone to Heaven Tee",
      category: "apparel",
      description: "Classic Pixies artwork on black cotton",
      imageUrl:
        "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=600&q=80",
    },
    "Pixies",
  ),
  curatedItem(
    {
      id: "pixies-poster-tour",
      artistId: "pixies",
      name: "Reunion Tour Lithograph",
      category: "poster",
      description: "Limited edition numbered print",
      imageUrl:
        "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=600&q=80",
    },
    "Pixies",
  ),
  curatedItem(
    {
      id: "pixies-pin-set",
      artistId: "pixies",
      name: "Enamel Pin Set",
      category: "accessory",
      description: "Set of 4 album art pins",
      imageUrl:
        "https://images.unsplash.com/photo-1614680376739-414d95ff43df?auto=format&fit=crop&w=600&q=80",
    },
    "Pixies",
  ),
]

// ─── Data access ────────────────────────────────────────────

export function getMerchForArtist(artistId: string) {
  const items = merchItems.filter((m) => m.artistId === artistId)
  const featured = items.find((m) => m.isFeatured)
  const rest = items.filter((m) => !m.isFeatured)

  const byCategory = rest.reduce<Record<string, typeof rest>>((acc, item) => {
    const key = item.category
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return { featured, byCategory, hasCuratedItems: items.length > 0 }
}
