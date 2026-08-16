'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { Logo } from '@/app/components/Logo'

type Screen = 'home' | 'shop' | 'cart' | 'login' | 'checkout' | 'success' | 'staff-access' | 'staff-create' | 'staff-login' | 'admin-login'

const DEMO_PRODUCTS = [
  { id: 'demo-1', name: 'Roller meal', size: '10 kg', price: 9.5, category: 'Groceries' },
  { id: 'demo-2', name: 'Pure cooking oil', size: '2 L', price: 4.8, category: 'Groceries' },
  { id: 'demo-3', name: 'Long grain rice', size: '2 kg', price: 4.25, category: 'Groceries' },
  { id: 'demo-4', name: 'Laundry powder', size: '1 kg', price: 3.4, category: 'Cleaning' },
  { id: 'demo-5', name: 'Bath soap pack', size: '4 pack', price: 2.75, category: 'Personal care' },
  { id: 'demo-6', name: 'Emergency candles', size: '6 pack', price: 1.9, category: 'Daily use' },
] as const

const usd = (amount: number) => `$${amount.toFixed(2)}`

export function DesignPreview({ preview = true }: { preview?: boolean }) {
  const [screen, setScreen] = useState<Screen>('home')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const [forSomeoneElse, setForSomeoneElse] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)

  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  const subtotal = DEMO_PRODUCTS.reduce(
    (sum, product) => sum + product.price * (cart[product.id] ?? 0),
    0,
  )
  const visible = useMemo(
    () => DEMO_PRODUCTS.filter((product) => product.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  )

  function add(id: string) {
    setCart((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }))
  }

  function quantity(id: string, next: number) {
    setCart((current) => {
      const updated = { ...current }
      if (next <= 0) delete updated[id]
      else updated[id] = next
      return updated
    })
  }

  return (
    <div className="fixed inset-0 z-[100] min-h-dvh overflow-y-auto bg-paper">
      {preview && (
        <div className="sticky top-0 z-[70] border-b border-orange-300 bg-orange-100 px-gutter py-3 text-center font-mono text-[0.68rem] font-bold uppercase tracking-label text-orange-950">
          Design preview · sample products and prices · no backend or payment
        </div>
      )}

      <nav className={`sticky ${preview ? 'top-[2.7rem]' : 'top-0'} z-[60] border-b border-rule bg-white/95 shadow-sm backdrop-blur-md`}>
        <div className="mx-auto flex max-w-[86rem] items-center gap-5 px-gutter py-4 lg:gap-8">
          <button type="button" onClick={() => setScreen('home')} aria-label="Muroora Mart preview home" className="shrink-0 text-left">
            <Logo className="h-12" />
            <span className="mt-1 hidden text-[0.65rem] font-medium text-support sm:block">Modern local shopping · Mutare</span>
          </button>

          <div className="ml-auto hidden items-center gap-7 lg:flex">
            <button type="button" onClick={() => setScreen('shop')} className="text-small font-medium text-support hover:text-accent">Shop⌄</button>
            <button type="button" onClick={() => setScreen('home')} className="text-small font-medium text-support hover:text-accent">How It Works</button>
            <button type="button" onClick={() => setScreen('shop')} className="text-small font-medium text-support hover:text-accent">Diaspora</button>
            <button type="button" onClick={() => setScreen('home')} className="text-small font-medium text-support hover:text-accent">About</button>
            <button type="button" onClick={() => setScreen('home')} className="text-small font-medium text-support hover:text-accent">Contact</button>
          </div>

          <label className="ml-auto hidden min-h-11 w-52 items-center gap-3 rounded-md bg-paper-sunk px-4 xl:flex">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
            <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setScreen('shop') }} placeholder="Search products..." className="min-w-0 flex-1 bg-transparent text-small outline-none" />
          </label>

          <button type="button" onClick={() => setScreen('login')} className="inline-flex min-h-11 shrink-0 items-center gap-2 text-small font-medium text-support hover:text-accent">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="7" r="3.5"/><path d="M5 21c.6-4.6 2.9-7 7-7s6.4 2.4 7 7"/></svg>
            <span className="hidden sm:inline">Log in</span>
          </button>
          <button type="button" onClick={() => setScreen('cart')} aria-label={`Cart with ${itemCount} items`} className="relative inline-flex size-11 shrink-0 items-center justify-center text-support">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6.5 8.5h11l1 12h-13l1-12Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
            <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-accent text-[0.65rem] font-bold text-white">{itemCount}</span>
          </button>
        </div>
      </nav>

      {screen === 'home' && (
        <main>
          <section className="grid min-h-[32rem] border-b border-rule bg-[#fbfaf6] lg:grid-cols-2">
            <div className="flex items-center px-gutter py-16 lg:justify-end lg:py-20">
              <div className="w-full max-w-[38rem] lg:pr-12">
                <h1 className="max-w-[12ch] text-mega leading-[1.02] text-support">The shopping gets <span className="text-accent">done</span>, wherever you are.</h1>
                <p className="mt-6 max-w-[48ch] text-lead text-ink-soft">Shop quality products from Muroora Mart in Mutare. We’ll prepare and deliver to your door or to someone you care about.</p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <button type="button" onClick={() => setScreen('shop')} className="bg-accent px-9 py-4 font-mono text-micro font-bold uppercase tracking-label text-white hover:bg-accent-deep">Shop now</button>
                  <button type="button" onClick={() => setScreen('login')} className="border border-support px-9 py-4 font-mono text-micro font-bold uppercase tracking-label text-support hover:bg-support hover:text-white">Log in</button>
                </div>
              </div>
            </div>
            <div className="relative min-h-[24rem] lg:min-h-full">
              <Image src="/hero/courtyard.png" alt="Traveller arriving at a Zimbabwean courtyard" fill priority className="object-cover object-[58%_50%]" />
              <div aria-hidden className="absolute inset-y-0 left-0 hidden w-20 bg-gradient-to-r from-[#fbfaf6] to-transparent lg:block" />
            </div>
          </section>
          <section className="bg-[#fffdfa] px-gutter py-12 md:py-16">
            <div className="mx-auto max-w-[76rem] text-center">
              <p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-accent">How Muroora works</p>
              <h2 className="mt-4 text-h1 text-support">Real goods. A real recipient. One clear order.</h2>
              <div className="mt-12 grid gap-8 text-left md:grid-cols-3 md:gap-0">
                {[
                  ['Choose what they need', 'Browse products and add them to your cart.'],
                  ['Tell us who receives it', 'Provide their details and delivery address.'],
                  ['Muroora prepares delivery', 'We pick, pack and deliver with care.'],
                ].map(([title, body], index) => (
                  <article key={title} className="relative px-7 py-3 md:border-r md:border-rule md:last:border-r-0">
                    <span className="block font-mono text-[2rem] font-extrabold leading-none text-accent">0{index + 1}</span>
                    <h3 className="mt-5 text-h4 font-bold text-support">{title}</h3>
                    <p className="mt-3 text-ink-soft">{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}

      {screen === 'shop' && (
        <main>
          <header className="bg-support px-gutter py-12 text-white"><div className="mx-auto max-w-[86rem]"><p className="font-mono text-micro uppercase tracking-label text-orange-200">{preview ? 'Demo catalogue' : 'Muroora catalogue'}</p><h1 className="mt-3 text-mega leading-none">What the household needs.</h1></div></header>
          <section className="mx-auto max-w-[86rem] px-gutter py-8">
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products…" className="min-h-12 w-full border border-rule bg-white px-4 outline-none focus:border-support" />
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{visible.map((product) => <article key={product.id} className="flex flex-col border border-rule bg-white"><div className="flex aspect-square items-end bg-[linear-gradient(145deg,var(--color-paper-sunk),var(--color-accent-wash))] p-5"><span className="text-h4 font-bold text-support">{product.name}</span></div><div className="flex flex-1 flex-col p-4"><p className="font-mono text-[0.65rem] uppercase tracking-label text-support">In stock</p><p className="mt-2 text-small text-ink-faint">{product.size}</p><p className="mt-4 text-h4 font-extrabold">{usd(product.price)}</p><button type="button" onClick={() => add(product.id)} className="mt-5 bg-accent px-3 py-3 font-mono text-[0.65rem] font-bold uppercase tracking-label text-white">Add to cart</button></div></article>)}</div>
          </section>
        </main>
      )}

      {screen === 'cart' && (
        <main className="mx-auto max-w-[72rem] px-gutter py-12">
          <p className="font-mono text-micro uppercase tracking-label text-accent">Your basket</p><h1 className="mt-3 text-mega leading-none">Cart</h1>
          {itemCount === 0 ? <div className="mt-9 border border-rule bg-paper-sunk p-12 text-center"><h2 className="text-h2">Your cart is empty</h2><button type="button" onClick={() => setScreen('shop')} className="mt-6 bg-accent px-7 py-4 font-mono text-micro uppercase tracking-label text-white">Browse products</button></div> : <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_20rem]"><ul className="divide-y divide-rule border-y border-rule">{DEMO_PRODUCTS.filter((product) => cart[product.id]).map((product) => <li key={product.id} className="flex items-center justify-between gap-4 py-5"><div><h2 className="font-bold">{product.name}</h2><p className="mt-1 text-small text-ink-faint">{product.size} · {usd(product.price)} each</p></div><div className="flex items-center gap-3"><button type="button" onClick={() => quantity(product.id, cart[product.id] - 1)} className="size-10 border border-rule">−</button><span>{cart[product.id]}</span><button type="button" onClick={() => quantity(product.id, cart[product.id] + 1)} className="size-10 border border-rule">+</button></div></li>)}</ul><aside className="bg-paper-sunk p-6"><div className="flex justify-between"><span>Subtotal</span><strong>{usd(subtotal)}</strong></div><p className="mt-3 text-small text-ink-faint">Demo delivery: shown at checkout</p><button type="button" onClick={() => setScreen(loggedIn ? 'checkout' : 'login')} className="mt-6 w-full bg-accent px-5 py-4 font-mono text-micro font-bold uppercase tracking-label text-white">Checkout</button></aside></div>}
        </main>
      )}

      {screen === 'login' && (
        <main className="mx-auto max-w-md px-gutter py-14">
          <p className="font-mono text-micro uppercase tracking-label text-accent">Customer account</p>
          <h1 className="mt-3 text-mega leading-none">Log in</h1>
          <p className="mt-5 text-ink-soft">Log in before checkout, or create an account if this is your first order.</p>
          <form onSubmit={(event) => { event.preventDefault(); setLoggedIn(true); setScreen(itemCount > 0 ? 'checkout' : 'shop') }} className="mt-8 space-y-5 border border-rule bg-white p-6">
            <label className="block text-small font-bold">Email<input required type="email" className="mt-2 min-h-12 w-full border border-rule px-4" /></label>
            <label className="block text-small font-bold">Password<input required type="password" minLength={8} className="mt-2 min-h-12 w-full border border-rule px-4" /></label>
            <button type="submit" className="w-full bg-accent px-6 py-4 font-mono text-micro font-bold uppercase tracking-label text-white">Continue securely</button>
            <button type="button" onClick={() => { setLoggedIn(true); setScreen(itemCount > 0 ? 'checkout' : 'shop') }} className="w-full border border-support px-6 py-4 font-mono text-micro font-bold uppercase tracking-label text-support">Create account</button>
          </form>
          {preview && <p className="mt-4 text-small text-ink-faint">Preview only: any valid-looking details continue. Nothing is saved.</p>}
        </main>
      )}

      {screen === 'checkout' && (
        <main className="mx-auto max-w-[72rem] px-gutter py-12">
          <p className="font-mono text-micro uppercase tracking-label text-accent">Checkout</p><h1 className="mt-3 text-mega leading-none">Who is it for?</h1>
          <form onSubmit={(event) => { event.preventDefault(); setScreen('success') }} className="mt-9 grid gap-7 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-6"><fieldset className="border border-rule p-6"><legend className="px-2 font-mono text-micro uppercase tracking-label text-accent">Buyer</legend><div className="grid gap-4 sm:grid-cols-2"><label className="text-small font-bold">Your name<input required className="mt-2 min-h-12 w-full border border-rule px-4" /></label><label className="text-small font-bold">Email<input required type="email" className="mt-2 min-h-12 w-full border border-rule px-4" /></label></div><label className="mt-5 flex items-center gap-3"><input type="checkbox" checked={!forSomeoneElse} onChange={(e) => setForSomeoneElse(!e.target.checked)} className="size-5 accent-support" /> I am receiving this order</label>{forSomeoneElse && <div className="mt-5 grid gap-4 border-l-4 border-support pl-5 sm:grid-cols-2"><label className="text-small font-bold">Recipient name<input required className="mt-2 min-h-12 w-full border border-rule px-4" /></label><label className="text-small font-bold">Zimbabwe phone<input required className="mt-2 min-h-12 w-full border border-rule px-4" /></label></div>}</fieldset><fieldset className="border border-rule p-6"><legend className="px-2 font-mono text-micro uppercase tracking-label text-accent">Delivery</legend><label className="text-small font-bold">Address<input required className="mt-2 min-h-12 w-full border border-rule px-4" /></label><label className="mt-4 block text-small font-bold">Demo suburb<select required className="mt-2 min-h-12 w-full border border-rule px-4"><option>Dangamvura</option><option>Chikanga</option><option>CBD</option></select></label></fieldset></div>
            <aside className="h-fit bg-paper-sunk p-6"><p className="font-mono text-micro uppercase tracking-label text-accent">Order total</p><div className="mt-5 flex justify-between"><span>Merchandise</span><strong>{usd(subtotal)}</strong></div><div className="mt-3 flex justify-between"><span>Delivery</span><strong>$2.00</strong></div><div className="mt-5 flex justify-between border-t border-rule pt-5 text-h4"><strong>Total</strong><strong>{usd(subtotal + 2)}</strong></div>{preview && <p className="mt-5 text-small text-ink-faint">No payment is processed.</p>}<button type="submit" className="mt-6 w-full bg-accent px-5 py-4 font-mono text-micro font-bold uppercase tracking-label text-white">Place order</button></aside>
          </form>
        </main>
      )}

      {screen === 'success' && (
        <main className="mx-auto max-w-2xl px-gutter py-16 text-center"><span className="mx-auto flex size-16 items-center justify-center rounded-full bg-support text-3xl text-white">✓</span><p className="mt-7 font-mono text-micro uppercase tracking-label text-support">Demo order received</p><h1 className="mt-3 text-mega leading-none">The shopping is in motion.</h1><p className="mt-5 text-lead text-ink-soft">Reference <strong>MM-DEMO-001</strong>. No database record or payment was created.</p><button type="button" onClick={() => { setCart({}); setScreen('home') }} className="mt-8 bg-accent px-8 py-4 font-mono text-micro uppercase tracking-label text-white">Restart preview</button></main>
      )}

      {screen === 'staff-access' && (
        <main className="mx-auto max-w-2xl px-gutter py-16 text-center">
          <p className="font-mono text-micro uppercase tracking-label text-accent">Muroora team</p>
          <h1 className="mt-3 text-mega leading-none">Staff access</h1>
          <p className="mx-auto mt-5 max-w-lg text-ink-soft">Choose how you want to continue.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <button type="button" onClick={() => setScreen('staff-create')} className="border border-support bg-support p-8 text-left text-white transition-transform hover:-translate-y-1"><span className="font-mono text-micro uppercase tracking-label text-orange-200">New staff</span><strong className="mt-3 block text-h3">Create account</strong></button>
            <button type="button" onClick={() => setScreen('staff-login')} className="border border-rule bg-white p-8 text-left transition-transform hover:-translate-y-1"><span className="font-mono text-micro uppercase tracking-label text-support">Existing staff</span><strong className="mt-3 block text-h3">Log in</strong></button>
          </div>
          <button type="button" onClick={() => setScreen('home')} className="mt-8 font-mono text-micro uppercase tracking-label text-ink-faint hover:text-support">Back to shop</button>
        </main>
      )}

      {(screen === 'staff-create' || screen === 'staff-login') && (
        <main className="mx-auto max-w-md px-gutter py-14">
          <p className="font-mono text-micro uppercase tracking-label text-accent">Staff access</p>
          <h1 className="mt-3 text-h1">{screen === 'staff-create' ? 'Create staff account' : 'Staff login'}</h1>
          <form onSubmit={(event) => { event.preventDefault(); setScreen('staff-access') }} className="mt-8 space-y-5 border border-rule bg-white p-6">
            {screen === 'staff-create' && <label className="block text-small font-bold">Full name<input required className="mt-2 min-h-12 w-full border border-rule px-4" /></label>}
            <label className="block text-small font-bold">Email<input required type="email" className="mt-2 min-h-12 w-full border border-rule px-4" /></label>
            <label className="block text-small font-bold">Password<input required type="password" minLength={8} className="mt-2 min-h-12 w-full border border-rule px-4" /></label>
            {screen === 'staff-create' && <label className="block text-small font-bold">Confirm password<input required type="password" minLength={8} className="mt-2 min-h-12 w-full border border-rule px-4" /></label>}
            <button type="submit" className="w-full bg-support px-6 py-4 font-mono text-micro font-bold uppercase tracking-label text-white">{screen === 'staff-create' ? 'Create staff account' : 'Log in'}</button>
          </form>
          <p className="mt-4 text-small text-ink-faint">Preview only. New staff accounts will require admin approval when the backend is connected.</p>
          <button type="button" onClick={() => setScreen('staff-access')} className="mt-5 font-mono text-micro uppercase tracking-label text-support">Back to staff options</button>
        </main>
      )}

      {screen === 'admin-login' && (
        <main className="mx-auto max-w-md px-gutter py-14">
          <p className="font-mono text-micro uppercase tracking-label text-accent">Restricted access</p>
          <h1 className="mt-3 text-h1">Admin login</h1>
          <p className="mt-4 text-ink-soft">For the three authorised Muroora Mart administrators only.</p>
          <form onSubmit={(event) => event.preventDefault()} className="mt-8 space-y-5 border border-rule bg-white p-6">
            <label className="block text-small font-bold">Admin email<input required type="email" className="mt-2 min-h-12 w-full border border-rule px-4" /></label>
            <label className="block text-small font-bold">Password<input required type="password" minLength={8} className="mt-2 min-h-12 w-full border border-rule px-4" /></label>
            <button type="submit" className="w-full bg-ink px-6 py-4 font-mono text-micro font-bold uppercase tracking-label text-white">Admin login</button>
          </form>
          <p className="mt-4 text-small text-ink-faint">Admin accounts cannot be created here. Their passwords will be set privately by the owner.</p>
          <button type="button" onClick={() => setScreen('home')} className="mt-5 font-mono text-micro uppercase tracking-label text-support">Back to shop</button>
        </main>
      )}

      <footer className="mt-auto border-t border-rule bg-paper-sunk px-gutter py-8 text-center">
        <p className="text-small text-ink-faint">{preview ? 'Muroora Mart frontend approval preview' : 'Muroora Mart · Modern local shopping in Mutare'}</p>
        <div className="mt-3 flex justify-center gap-6">
          <button type="button" onClick={() => setScreen('staff-access')} className="font-mono text-[0.62rem] uppercase tracking-label text-ink-faint transition-colors hover:text-support">Staff login</button>
          <button type="button" onClick={() => setScreen('admin-login')} className="font-mono text-[0.62rem] uppercase tracking-label text-ink-faint transition-colors hover:text-support">Admin login</button>
        </div>
      </footer>
    </div>
  )
}
