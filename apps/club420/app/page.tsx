import Image from 'next/image'
import Link from 'next/link'
import { Reveal } from '@pineberry/ui'
import { SITE, STORY, EXPERIENCES, LEGAL } from '@/app/data/site'

export default function HomePage() {
  return (
    <main>
      {/* Hero. The photograph is the client's own — a bottle being opened at a
          field in Mutare at golden hour, which is the brand's whole idea in
          one frame and needed no art direction to explain. */}
      <section className="relative isolate overflow-hidden border-b border-rule">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/photos/toast-field.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[50%_38%]"
          />
        </div>
        {/* Two scrims: a broad one for overall legibility and a bottom-weighted
            one so the headline sits on near-solid ground rather than on grass. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(120%_100%_at_50%_25%,rgba(15,16,13,0.35)_0%,rgba(15,16,13,0.8)_100%)]"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-[linear-gradient(to_top,var(--color-paper)_4%,rgba(15,16,13,0.9)_38%,transparent_100%)]"
        />

        <div className="mx-auto flex min-h-[78vh] max-w-[86rem] flex-col justify-end px-gutter pb-20 pt-32">
          <p className="stamp w-fit">
            {SITE.city} · Since {SITE.founded}
          </p>

          <h1 className="mt-8 max-w-[11ch] text-mega leading-[0.85]">
            Time to <span className="text-accent">toast</span>
          </h1>

          <p className="mt-8 max-w-[46ch] text-h4 font-normal leading-snug text-ink">
            Every day has a 4:20 in it. The work stops, the glass comes out, and
            for one hour the day belongs to you.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link
              href="/range"
              className="bg-accent px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-paper transition-colors duration-200 hover:bg-accent-deep"
            >
              What we pour
            </Link>
            <Link
              href="/story"
              className="group inline-flex items-center gap-3 border border-ink-faint px-8 py-4 font-mono text-small uppercase tracking-label text-ink transition-colors duration-200 hover:border-accent hover:text-accent"
            >
              Why 4:20
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* The disclaimer sits high on the home page, not just in the footer.
          Someone landing on a site called 420 forms an assumption in about two
          seconds, and correcting it late is worse than correcting it early. */}
      <section className="border-b border-rule bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-10">
          <p className="max-w-[80ch] text-ink-soft">
            <span className="font-bold text-ink">A quick clarification.</span>{' '}
            {LEGAL.notCannabis} {LEGAL.licensed}
          </p>
        </div>
      </section>

      {/* The story, told short here with the full version a click away. */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <div aria-hidden className="gold-rule h-px w-full" />
              <h2 className="mt-8 max-w-[14ch] text-h1">{STORY.lead}</h2>
              <div className="mt-8 max-w-measure space-y-5 text-lead text-ink-soft">
                <p>{STORY.paragraphs[0]}</p>
                <p>{STORY.paragraphs[1]}</p>
              </div>
              <Link
                href="/story"
                className="group mt-10 inline-flex items-center gap-3 border-b border-accent pb-1 font-mono text-micro uppercase tracking-label text-accent"
              >
                The whole story
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </div>

            <div className="lg:col-span-6">
              <Reveal from="up" className="relative aspect-4/5 w-full">
                <Image
                  src="/photos/pilsener-night.jpg"
                  alt="A cold Golden Pilsener poured out at 420, Mutare"
                  fill
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  className="object-cover"
                />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Experiences. The 4:20 hour leads because it is the ritual. */}
      <section className="bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div aria-hidden className="gold-rule h-px w-full" />
          <h2 className="mt-8 max-w-[16ch] text-h1">What happens here</h2>

          <ul className="mt-14 grid grid-cols-1 gap-px bg-rule md:grid-cols-2">
            {EXPERIENCES.map((item, index) => (
              <Reveal
                key={item.title}
                as="li"
                from="up"
                delay={(index % 2) * 0.07}
                className="group bg-paper-sunk p-8 transition-colors duration-300 hover:bg-paper lg:p-10"
              >
                <p className="font-mono text-micro uppercase tracking-label text-accent">
                  {item.time}
                </p>
                <h3 className="mt-5 text-h4">{item.title}</h3>
                <p className="mt-3 text-ink-soft">{item.body}</p>
              </Reveal>
            ))}
          </ul>

          <Link
            href="/experiences"
            className="group mt-12 inline-flex items-center gap-3 border-b border-accent pb-1 font-mono text-micro uppercase tracking-label text-accent"
          >
            All of it
            <span
              aria-hidden
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </section>
    </main>
  )
}
