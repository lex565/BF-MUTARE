import type { Metadata } from 'next'

import { CartView } from '@/app/components/shop/CartView'

export const metadata: Metadata = {
  title: 'Your cart',
  description: 'Review your Muroora Mart basket before checkout.',
}

export default function CartPage() {
  return (
    <main className="border-b border-rule">
      <header className="bg-support text-white">
        <div className="mx-auto max-w-[86rem] px-gutter py-12 md:py-16">
          <p className="font-mono text-micro uppercase tracking-label text-orange-200">
            Your basket
          </p>
          <h1 className="mt-3 text-mega leading-none">Cart</h1>
          <p className="mt-5 max-w-xl text-lead text-white/80">
            Check quantities now. Delivery is calculated later from the recipient’s address.
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-[86rem] px-gutter py-10 md:py-16">
        <CartView />
      </div>
    </main>
  )
}
