import { Logo } from '@/app/components/Logo'
import { MusuwoLogo } from '@/app/components/MusuwoLogo'
import { isMuroora } from '@/lib/brand'

/**
 * Whichever logo belongs to this deployment.
 *
 * The sign-in, staff, management and password screens used to draw Muroora
 * Mart's logo unconditionally, on both websites. Somebody signing in to
 * Musuwo was shown another company's name and mark at the exact moment they
 * were being asked for a password, which is the shape of a phishing page and
 * is the one screen where a person must be certain where they are.
 *
 * Nav and Footer already chose per brand; they simply were not the files
 * anybody logs in through. Use this everywhere rather than importing `Logo`
 * directly, so the next screen added cannot get it wrong again.
 *
 * `className` is passed through to whichever mark is drawn. The two are
 * different shapes - Muroora's is a wide raster wordmark sized by height,
 * Musuwo's is a square mark next to live text - so heights are approximate
 * between them by nature.
 */
export function SiteLogo({ className = 'h-11' }: { className?: string }) {
  return isMuroora ? <Logo className={className} /> : <MusuwoLogo />
}
