import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { CheckoutView } from '@/app/components/shop/CheckoutView'
import { currentUser } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Choose who will receive your Muroora Mart order and where it should be delivered.',
}

export default async function CheckoutPage() {
  const user = await currentUser()

  if (!user) redirect('/login?next=/checkout')

  return (
    <main className="border-b border-rule bg-paper-sunk">
      <header className="border-b border-rule bg-support text-white">
        <div className="mx-auto max-w-[86rem] px-gutter py-12 md:py-16">
          <p className="font-mono text-micro uppercase tracking-label text-orange-200">Secure customer checkout</p>
          <h1 className="mt-3 text-mega leading-none">Who is it for?</h1>
          <p className="mt-5 max-w-2xl text-lead text-white/80">Buy for yourself in Mutare, or send the household shop to somebody back home.</p>
        </div>
      </header>
      <div className="mx-auto max-w-[86rem] px-gutter py-10 md:py-16">
        <CheckoutView />
      </div>
    </main>
  )
}
