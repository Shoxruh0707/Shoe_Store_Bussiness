export interface StoreProduct {
  id: string
  artNo: string
  name: string
  originalPrice?: number | null
  price: number
  season?: string | null
  category: string
  color: string
  colors: string[]
  sizes: string[]
  material: string
  type: string
  brand: string
  image: string | null
  images?: string[]
  rating: number
  reviews: number
  description: string
  inStock: boolean
  stockQuantity: number
  createdAt: string
}

export interface InventoryItem {
  id: string
  product: string
  color: string
  size: string
  quantity: number
  reorderLevel: number
  lastRestocked: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/backend-api'

export function assetUrl(path?: string | null) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE}${path}`
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Database request failed')
  }

  return data
}

export async function getProducts(limit?: number) {
  const query = limit ? `?limit=${limit}` : ''
  const data = await requestJson<{ products: StoreProduct[] }>(`/api/store/products${query}`)
  return data.products
}

export async function getProduct(id: string) {
  return requestJson<{ product: StoreProduct; relatedProducts: StoreProduct[] }>(
    `/api/store/products/${id}`
  )
}

export async function getInventory() {
  const data = await requestJson<{ inventory: InventoryItem[] }>('/api/store/inventory')
  return data.inventory
}
