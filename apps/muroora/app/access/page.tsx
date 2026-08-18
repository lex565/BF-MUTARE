import Link from 'next/link'

import { SiteLogo } from '@/app/components/SiteLogo'
import { brand, isMuroora } from '@/lib/brand'

/**
 * Choosing which way in: as a person shopping, or as a business.
 *
 * BRAND-AWARE, because it was not. This page said "Choose your Musuwo account"
 * and "How are you using Musuwo?" on BOTH websites, so somebody signing in to
 * Muroora Mart - a grocer, with its own name over the door - was asked about an
 * account with a company they may never have heard of, on the screen where they
 * are about to type a password. Muroora Mart's customers buy from Muroora Mart.
 *
 * The business half also differs. On Musuwo, registering a business is the
 * point, so it is offered here. On Muroora Mart it is not: that site is one
 * shop, and its "business" entrance is its own staff and management door.
 */
export default function AccessPage() {
  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-paper-sunk px-gutter py-14">
      <div className="mx-auto max-w-[64rem]">
        <Link href="/" className="inline-flex">
          <SiteLogo className="h-11" />
        </Link>

        <div className="mt-12 text-center">
          <p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-accent">
            {isMuroora ? 'Muroora Mart account' : 'Choose your Musuwo account'}
          </p>
          <h1 className="mt-4 text-mega leading-none text-support">
            How are you using {brand.name}?
          </h1>
          <p className="mx-auto mt-5 max-w-[55ch] text-lead text-ink-soft">
            {isMuroora
              ? 'Shopping with us, or working here? The two are separate, even when the same person does both.'
              : 'Your individual shopping space and business workspace stay separate, even when the same person uses both.'}
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Link
            href="/login?next=/account"
            className="group rounded-2xl border border-rule bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-accent"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-accent-wash text-2xl">
              🧺
            </span>
            <p className="mt-7 font-mono text-micro font-bold uppercase tracking-label text-accent">
              {isMuroora ? 'Shopping' : 'Personal shopping'}
            </p>
            <h2 className="mt-3 text-h2 text-support">
              {isMuroora ? 'Sign in to shop' : 'Log in as an individual'}
            </h2>
            <p className="mt-4 text-ink-soft">
              {isMuroora
                ? 'Buy groceries and household goods, send an order to family in Mutare, and track the delivery.'
                : 'Browse products, shop from businesses, send orders to family and track deliveries.'}
            </p>
            <strong className="mt-7 inline-block text-accent">
              Continue &rarr;
            </strong>
          </Link>

          <Link
            href="/management-access"
            className="group rounded-2xl bg-support p-8 text-white shadow-sm transition hover:-translate-y-1"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-white/10 text-2xl">
              🏪
            </span>
            <p className="mt-7 font-mono text-micro font-bold uppercase tracking-label text-[#ffb37a]">
              {isMuroora ? 'Staff and management' : 'Store management'}
            </p>
            <h2 className="mt-3 text-h2 text-white">
              {isMuroora ? 'Sign in to work here' : 'Log in as a business'}
            </h2>
            <p className="mt-4 text-white/70">
              {isMuroora
                ? 'Shelves, orders, deliveries and reports. Access is issued by management.'
                : 'Manage your business profile, products, prices, orders and availability.'}
            </p>
            <strong className="mt-7 inline-block text-[#ffb37a]">
              Continue &rarr;
            </strong>
          </Link>
        </div>

        {/* Only on Musuwo. Muroora Mart is one shop; inviting its customers to
            register a business on the sign-in screen would be an odd thing for
            a grocer to ask. */}
        {!isMuroora && (
          <p className="mt-8 text-center text-small text-ink-faint">
            Want to register a business?{' '}
            <Link
              href="/marketplace/apply"
              className="font-bold text-support underline"
            >
              Start a Musuwo business application
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  )
}
