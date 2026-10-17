export type Recipe = {
  id: string
  temperatureC: number
  grindStep: number
  note: string
}

export type CoffeePack = {
  id: string
  name: string
  country: string
  region: string
  variety: string
  process: string
  priceEur: number | null
  shop: string
  rating: number | null
  notes: string
  imageUrl: string | null
  imagePath: string | null
  createdAt: string
  recipes: Recipe[]
}

export type CoffeePackInput = Omit<CoffeePack, 'imageUrl' | 'imagePath' | 'createdAt'> & {
  imageUrl?: string | null
  imagePath?: string | null
  createdAt?: string
}
