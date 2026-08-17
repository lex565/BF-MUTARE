'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { MusuwoLogo } from '@/app/components/MusuwoLogo'

type MusuwoProduct = { id:string; name:string; slug:string; description:string|null; unitSize:string|null; price:string; imageUrl:string|null; merchant:{name:string;slug:string;logoUrl:string|null} }

export function MusuwoShopCatalogue({ products, initialQuery }: { products: MusuwoProduct[]; initialQuery: string }) {
  const [query,setQuery]=useState(initialQuery)
  const visible=useMemo(()=>{const needle=query.trim().toLowerCase();return products.filter((product)=>!needle||`${product.name} ${product.merchant.name} ${product.unitSize??''}`.toLowerCase().includes(needle))},[products,query])
  return <main className="min-h-dvh bg-[#f6f7f2]">
    <header className="overflow-hidden bg-[#17372d] text-white"><div className="mx-auto max-w-[86rem] px-gutter py-10 md:py-16"><Link href="/" className="inline-flex rounded-xl bg-white px-4 py-2"><MusuwoLogo/></Link><div className="mt-10 grid gap-8 lg:grid-cols-[1fr_28rem] lg:items-end"><div><p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-[#ffb37a]">Musuwo Shop</p><h1 className="mt-4 max-w-[13ch] text-mega leading-[0.95]">Products from businesses you can trust.</h1></div><p className="text-lead text-white/70">Search one catalogue. Every product stays connected to the business selling it, while your basket and checkout remain on Musuwo.</p></div></div></header>
    <section className="mx-auto max-w-[86rem] px-gutter py-10">
      <label className="relative block rounded-2xl bg-white shadow-[0_16px_50px_rgba(23,55,45,0.10)]"><span className="sr-only">Search Musuwo products and businesses</span><svg aria-hidden="true" viewBox="0 0 24 24" className="absolute left-6 top-1/2 size-6 -translate-y-1/2 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search products or businesses on Musuwo…" className="min-h-16 w-full rounded-2xl bg-transparent py-4 pl-16 pr-5 text-lead outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-accent"/></label>
      {visible.length===0?<div className="my-14 overflow-hidden rounded-3xl border border-rule bg-white md:grid md:grid-cols-[0.8fr_1.2fr]"><div className="flex min-h-72 items-center justify-center bg-accent-wash text-7xl">🛒</div><div className="p-8 md:p-12"><p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-accent">Musuwo Shop</p><h2 className="mt-4 text-h1 text-support">Nothing to show for now.</h2><p className="mt-4 max-w-xl text-ink-soft">Products will appear here as soon as they are available.</p><Link href="/#businesses" className="mt-7 inline-flex rounded-full border border-support px-6 py-3 font-bold text-support hover:bg-support hover:text-white">Explore businesses instead</Link></div></div>:<div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visible.map((product)=><article key={product.id} className="rounded-2xl border border-rule bg-white p-5"><p className="font-mono text-micro uppercase tracking-label text-accent">{product.merchant.name}</p><h2 className="mt-3 text-h3">{product.name}</h2><p className="mt-2 text-small text-ink-soft">{product.unitSize}</p><Link href={`/marketplace/product/${product.slug}`} className="mt-6 inline-flex font-bold text-support">View product →</Link></article>)}</div>}
    </section>
  </main>
}
