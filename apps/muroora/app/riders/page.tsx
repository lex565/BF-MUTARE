import Image from 'next/image'
import { redirect } from 'next/navigation'

import { isMuroora, BRAND } from '@/lib/brand'

/**
 * Musuwo's rider recruitment, which is Musuwo's and not the grocer's.
 *
 * Muroora Mart's navigation does not link here, but the route existed on both
 * deployments and rendered the Musuwo logo and Musuwo copy on a Muroora page.
 * Now it forwards, so the address keeps working and the content stays where it
 * belongs.
 */
export default function RidersComingSoon() {
  if (isMuroora) redirect(`${BRAND.musuwo.url}/riders`)

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-[72rem] place-items-center px-gutter py-20 text-center">
      <div>
        <Image
          src="/musuwo-logo.png"
          alt="Musuwo"
          width={150}
          height={150}
          className="mx-auto size-36 object-contain"
        />
        <p className="mt-8 font-mono text-micro uppercase tracking-label text-accent">
          Musuwo delivery partners
        </p>
        <h1 className="mt-3 text-mega leading-none">Coming soon.</h1>
        <p className="mx-auto mt-6 max-w-xl text-lead text-ink-soft">
          Musuwo coordinates the customer delivery experience while businesses
          prepare orders. The independent public Musuwo rider network is not
          operating yet.
        </p>
        <span className="mt-8 inline-flex rounded-full bg-paper-sunk px-5 py-3 font-mono text-micro uppercase tracking-label text-ink-faint">
          Public rider applications are closed
        </span>
      </div>
    </main>
  )
}
