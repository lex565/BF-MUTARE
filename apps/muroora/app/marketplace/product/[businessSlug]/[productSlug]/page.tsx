import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { currentUser } from '@/lib/auth'
import { getMarketplaceProduct, recordMarketplaceProductView } from '@/lib/services/marketplace'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ businessSlug: string; productSlug: string }> }): Promise<Metadata> {
  const { businessSlug, productSlug } = await params
  const product = await getMarketplaceProduct(businessSlug, productSlug)
  return product ? { title: `${product.name} · ${product.merchant.name}`, description: product.description } : { title: 'Product not found' }
}

export default async function MarketplaceProductPage({ params }: { params: Promise<{ businessSlug: string; productSlug: string }> }) {
  const { businessSlug, productSlug } = await params
  const [product, user] = await Promise.all([getMarketplaceProduct(businessSlug, productSlug), currentUser()])
  if (!product) notFound()
  if (user) await recordMarketplaceProductView(user.id, product.id)
  const path = `/marketplace/product/${businessSlug}/${productSlug}`
  const shareText = encodeURIComponent(`${product.name} from ${product.merchant.name} on Musuwo: ${path}`)
  const contact = product.merchant.whatsappNumber?.replace(/\D/g, '')

  return <main className="mx-auto max-w-[72rem] px-gutter py-12">
    <Link href="/shop" className="font-bold text-support">← Back to Musuwo</Link>
    <div className="mt-8 grid gap-10 md:grid-cols-2">
      <div className="min-h-80 bg-paper-sunk">{product.imageUrl && <Image src={product.imageUrl} alt={product.name} width={800} height={800} className="h-full w-full object-cover" />}</div>
      <div><p className="font-mono text-micro uppercase tracking-label text-accent">{product.merchant.name}</p><h1 className="mt-3 text-h1">{product.name}</h1>{product.unitSize && <p className="mt-3 text-ink-soft">{product.unitSize}</p>}<p className="mt-5 text-h2 text-support">${product.price.decimal}</p>{product.description && <p className="mt-6 text-lead text-ink-soft">{product.description}</p>}
        <div className="mt-8 flex flex-wrap gap-3">{contact && <a href={`https://wa.me/${contact}?text=${shareText}`} target="_blank" rel="noreferrer" className="rounded-full bg-[#128c7e] px-6 py-3 font-bold text-white">Contact on WhatsApp</a>}<a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer" className="rounded-full border border-support px-6 py-3 font-bold text-support">Share on WhatsApp</a>{product.merchant.websiteUrl && <a href={product.merchant.websiteUrl} target="_blank" rel="noreferrer" className="rounded-full border border-rule px-6 py-3 font-bold">Business website</a>}</div>
      </div>
    </div>
  </main>
}
