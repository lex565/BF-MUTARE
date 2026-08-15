export interface WireMoney {
  amount: string
  currency: 'USD' | 'ZWL'
  decimal: string
}

export interface CatalogueCategory {
  id: string
  name: string
  slug: string
  description: string | null
}

export interface CatalogueProduct {
  id: string
  name: string
  slug: string
  sku: string
  brand: string | null
  description: string | null
  unitSize: string | null
  price: WireMoney
  promoPrice: WireMoney | null
  category: CatalogueCategory | null
  images: { path: string; alt: string | null }[]
  availability: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
}

export interface CartLine {
  itemId: string
  productId: string
  name: string
  slug: string
  unitSize: string | null
  quantity: number
  unitPrice: WireMoney
  lineTotal: WireMoney
  availability: CatalogueProduct['availability']
  exceedsStock: boolean
  sellable: number
}

export interface CartData {
  id: string
  itemCount: number
  subtotal: WireMoney
  hasProblems: boolean
  lines: CartLine[]
}

export type ApiEnvelope<T> = { data: T } | {
  error: { code: string; message: string; details?: unknown }
}

export function moneyLabel(value: WireMoney): string {
  return new Intl.NumberFormat('en-ZW', {
    style: 'currency',
    currency: value.currency,
    minimumFractionDigits: 2,
  }).format(Number(value.decimal))
}
