import Image from 'next/image'
import { Eyebrow, Reveal } from '@pineberry/ui'

/**
 * The Japan visit.
 *
 * Copy here is deliberately understated and describes only what is visibly
 * true in the photographs: a supplier team came from Japan, sat in the Mutare
 * office, and presented something. No claim is made about which company they
 * represent, what the award was for, or what any partnership formally is —
 * those are the client's to state, not mine to infer from a photo.
 *
 * Replace the copy below once you tell me what this visit actually was.
 */
const SHOTS = [
  {
    src: '/partnership/japan-visit-01.jpeg',
    alt: 'The BF Mutare team with visiting colleagues from Japan at the Mutare office',
  },
  {
    src: '/partnership/japan-visit-03.jpeg',
    alt: 'Handover of a presentation piece during the Japan team visit',
  },
  {
    src: '/partnership/japan-visit-02.jpeg',
    alt: 'The teams together during the visit',
  },
]

export function Partnership() {
  return (
    <section id="partners" className="border-y border-rule bg-paper-sunk">
      <div className="mx-auto max-w-[86rem] px-gutter py-section">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Eyebrow index={2}>Japan</Eyebrow>
            <h2 className="mt-5 text-h1">
              Our suppliers came to see us
            </h2>

            <div className="mt-8 max-w-measure space-y-5 text-ink-soft">
              <p>
                {/* TODO: replace with the real account of this visit. */}
                Our Japanese supplier team travelled to Mutare to meet the
                people they had been shipping to, walk the operation, and see
                where the vehicles end up.
              </p>
              <p>
                Buying a car from overseas asks you to trust a chain you cannot
                see. This is part of that chain, standing in our office.
              </p>
            </div>
          </div>

          {/* Offset trio rather than a neat 3-up row — these are candid office
              photos, and a rigid grid makes candid photos look like clip art. */}
          <div className="grid grid-cols-2 gap-4 lg:col-span-7">
            <Reveal from="up" className="col-span-2 relative aspect-16/10">
              <Image
                src={SHOTS[0].src}
                alt={SHOTS[0].alt}
                fill
                sizes="(max-width: 1024px) 100vw, 55vw"
                className="object-cover"
              />
            </Reveal>
            {SHOTS.slice(1).map((shot, index) => (
              <Reveal
                key={shot.src}
                from="up"
                delay={0.1 + index * 0.08}
                className="relative aspect-4/3"
              >
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  fill
                  sizes="(max-width: 1024px) 50vw, 28vw"
                  className="object-cover"
                />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
