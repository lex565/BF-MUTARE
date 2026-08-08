import Image from 'next/image'
import { Eyebrow, Reveal } from '@pineberry/ui'
import { SITE } from '@/app/data/site'

export function About() {
  return (
    <section id="about" className="mx-auto max-w-[86rem] px-gutter py-section">
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Eyebrow index={6}>About</Eyebrow>
          <h2 className="mt-5 text-h1">Based in Mutare, not a call centre</h2>

          <div className="mt-8 max-w-measure space-y-5 text-ink-soft">
            <p>
              BF Mutare imports vehicles from Japan to order, out of Mutare in
              Manicaland. You tell us the model, the budget and the timeline;
              we source it, ship it, clear it and hand you the keys.
            </p>
            <p>
              We photograph our own cars. Every image on this site is a vehicle
              that passed through our hands on its way to an owner, shot on a
              Mutare street — which is also why the paint has dust on it in
              some of them.
            </p>
            <p>
              BF Mutare is part of {SITE.parent}.
            </p>
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-8 border-t border-rule pt-8">
            <div>
              <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                Based
              </dt>
              <dd className="mt-2 font-display text-h4 font-bold">
                Mutare, ZW
              </dd>
            </div>
            <div>
              <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                Sourced from
              </dt>
              <dd className="mt-2 font-display text-h4 font-bold">Japan</dd>
            </div>
          </dl>
        </div>

        {/* Offset image pair. The interior shot deliberately overlaps and sits
            lower — a tidy 2-up grid here would read as a template block. */}
        <div className="relative lg:col-span-7">
          <Reveal from="up" className="relative aspect-16/11 w-[88%]">
            <Image
              src="/featured/impreza-silver-02.jpg"
              alt="A silver Subaru Impreza parked on a Mutare high street"
              fill
              sizes="(max-width: 1024px) 88vw, 46vw"
              className="object-cover"
            />
          </Reveal>
          <Reveal
            from="up"
            delay={0.12}
            className="relative -mt-[18%] ml-auto aspect-3/4 w-[46%] border-4 border-paper"
          >
            <Image
              src="/featured/bmw-x1-interior.jpg"
              alt="Interior of a BMW X1, right-hand drive"
              fill
              sizes="(max-width: 1024px) 46vw, 24vw"
              className="object-cover"
            />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
