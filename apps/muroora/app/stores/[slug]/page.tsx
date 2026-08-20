import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getPublicBusiness, listMarketplaceProducts } from '@/lib/services/marketplace'
import { ProductPhoto } from '@/app/components/marketplace/ProductPhoto'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const business = await getPublicBusiness(slug)
  if (!business) return { title: 'Business not found' }
  return { title: business.name, description: business.summary, icons: { icon: business.faviconPath || `/stores/${slug}/icon.svg` } }
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [business, allProducts] = await Promise.all([getPublicBusiness(slug), listMarketplaceProducts()])
  if (!business) notFound()
  const products = allProducts.filter(product => product.merchant.slug === slug)
  const whatsapp = business.whatsappNumber?.replace(/\D/g, '')
  return <main className="mx-auto max-w-[86rem] px-gutter py-12">
    <p className="font-mono text-micro uppercase tracking-label text-accent">Musuwo business</p><h1 className="mt-3 text-mega">{business.name}</h1>{business.summary && <p className="mt-5 max-w-2xl text-lead text-ink-soft">{business.summary}</p>}
    <div className="mt-7 flex flex-wrap gap-3">{business.websiteUrl && <a href={business.websiteUrl} target="_blank" rel="noreferrer" className="rounded-full border border-support px-5 py-3 font-bold text-support">Website</a>}{whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="rounded-full bg-[#128c7e] px-5 py-3 font-bold text-white">WhatsApp</a>}</div>
    <section className="mt-14"><h2 className="text-h2">Products</h2>{products.length === 0 ? <p className="mt-5 text-ink-soft">This business has not published products yet.</p> : <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.map(product => <Link key={product.id} href={`/marketplace/product/${slug}/${product.slug}`} className="flex flex-col border border-rule bg-paper hover:border-support"><ProductPhoto src={product.imageUrl} alt={product.name} /><div className="p-5"><h3 className="font-bold">{product.name}</h3><p className="mt-3 text-support">${product.price.decimal}</p></div></Link>)}</div>}</section>
  </main>
}
