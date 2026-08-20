'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { MusuwoLogo } from '@/app/components/MusuwoLogo'
import { ProductPhoto } from '@/app/components/marketplace/ProductPhoto'
import { productPath } from '@/lib/musuwo-urls'

type MusuwoProduct = {
  id: string; name: string; slug: string; description: string | null
  unitSize: string | null; price: string; imageUrl: string | null
  merchant: { name: string; slug: string; logoUrl: string | null; whatsappNumber: string | null; websiteUrl: string | null }
}

/**
 * The WhatsApp helper that used to sit here has been deleted, along with the
 * WhatsApp button on every product card.
 *
 * Two reasons. It made contacting a merchant directly the primary action on a
 * marketplace card, which routes the sale around Musuwo entirely - the
 * customer leaves, the order is never placed here, and no merchant analytics
 * ever record it. And the message it composed contained
 * `/marketplace/product/...`, a bare path with no host, so the recipient got
 * unclickable text.
 *
 * WhatsApp is now a SHARE channel (see ShareProduct) and a secondary "contact
 * about this item" link on the product page itself, which is where somebody
 * has enough context to have a real question.
 */

export function MusuwoShopCatalogue({ products, recommendedIds, initialQuery, signedIn }: {
  products: MusuwoProduct[]; recommendedIds: string[]; initialQuery: string; signedIn: boolean
}) {
  const [query, setQuery] = useState(initialQuery)
  /**
   * Open on whichever tab has something in it.
   *
   * This defaulted to FOR_YOU unconditionally. Recommendations need browsing
   * history and history needs a signed-in account, so every visitor who was
   * not signed in - which is everyone arriving from a shared link, a search
   * result or the homepage - landed on a tab reading "Nothing here yet" while
   * the marketplace had products one tab across. The shop looked empty and
   * broken to precisely the people seeing it for the first time.
   *
   * A signed-in customer with real recommendations still opens on For You,
   * which is the behaviour that was intended.
   */
  const [view, setView] = useState<'FOR_YOU' | 'EXPLORE'>(
    recommendedIds.length > 0 ? 'FOR_YOU' : 'EXPLORE',
  )
  const recommended = useMemo(() => new Set(recommendedIds), [recommendedIds])
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return products.filter(product =>
      (view === 'EXPLORE' || recommended.has(product.id)) &&
      (!needle || `${product.name} ${product.merchant.name} ${product.unitSize ?? ''}`.toLowerCase().includes(needle)),
    )
  }, [products, query, recommended, view])

  return <main className="min-h-dvh bg-[#f6f7f2]">
    <header className="overflow-hidden bg-[#17372d] text-white"><div className="mx-auto max-w-[86rem] px-gutter py-10 md:py-16"><Link href="/" className="inline-flex rounded-xl bg-white px-4 py-2"><MusuwoLogo /></Link><div className="mt-10 grid gap-8 lg:grid-cols-[1fr_28rem] lg:items-end"><div><p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-[#ffb37a]">Musuwo marketplace</p><h1 className="mt-4 max-w-[13ch] text-mega leading-[0.95]">Products from local businesses.</h1></div><p className="text-lead text-white/70">Every item names the independent business selling it. Muroora Mart is one merchant, not the marketplace itself.</p></div></div></header>
    <section className="mx-auto max-w-[86rem] px-gutter py-10">
      <div className="mb-6 flex gap-2"><button onClick={() => setView('FOR_YOU')} className={`rounded-full px-5 py-3 font-bold ${view === 'FOR_YOU' ? 'bg-support text-white' : 'border border-rule bg-white'}`}>For you</button><button onClick={() => setView('EXPLORE')} className={`rounded-full px-5 py-3 font-bold ${view === 'EXPLORE' ? 'bg-support text-white' : 'border border-rule bg-white'}`}>Explore all</button></div>
      <label className="relative block rounded-2xl bg-white shadow-[0_16px_50px_rgba(23,55,45,0.10)]"><span className="sr-only">Search Musuwo products and businesses</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search products or businesses on Musuwo…" className="min-h-16 w-full rounded-2xl bg-transparent px-6 py-4 text-lead outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-accent" /></label>
      {visible.length === 0 ? <div className="my-14 rounded-3xl border border-rule bg-white p-8 md:p-12"><p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-accent">{view === 'FOR_YOU' ? 'For you' : 'Musuwo marketplace'}</p><h2 className="mt-4 text-h1 text-support">{view === 'FOR_YOU' ? 'Nothing here yet.' : 'No products match.'}</h2><p className="mt-4 max-w-xl text-ink-soft">{view === 'FOR_YOU' ? (signedIn ? 'Browse products first. Recommendations will only appear after your real browsing gives Musuwo something useful to work with.' : 'Sign in and browse products to build your private recommendations.') : 'Products appear only after an approved business deliberately publishes them.'}</p>{view === 'FOR_YOU' && <button onClick={() => setView('EXPLORE')} className="mt-7 rounded-full border border-support px-6 py-3 font-bold text-support">Explore all products</button>}</div> : <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visible.map(product => <article key={product.id} className="overflow-hidden rounded-2xl border border-rule bg-white">
        <ProductPhoto src={product.imageUrl} alt={product.name} />
        <div className="p-5"><p className="font-mono text-micro uppercase tracking-label text-accent">{product.merchant.name}</p><h2 className="mt-3 text-h3">{product.name}</h2><p className="mt-2 text-small text-ink-soft">{product.unitSize}</p><p className="mt-3 text-h3 text-support">${product.price}</p><div className="mt-6 flex flex-wrap gap-3"><Link href={productPath(product.merchant.slug, product.slug)} className="font-bold text-support">View product →</Link></div></div>
      </article>)}</div>}
    </section>
  </main>
}
