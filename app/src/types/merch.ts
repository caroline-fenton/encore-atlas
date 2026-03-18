export type MerchCategory = "vinyl" | "apparel" | "poster" | "box-set" | "book" | "accessory"

export type MerchItem = {
  id: string
  artistId: string
  name: string
  category: MerchCategory
  description?: string
  storeUrl: string
  storeName: string
  imageUrl: string
  isFeatured?: boolean
}

export type StoreLink = {
  name: string
  url: string
  priority: number // 1 = Bandcamp, 2 = Amazon, 3 = Redbubble
}
