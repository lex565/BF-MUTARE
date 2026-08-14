import Image from 'next/image'

import { getPosts } from '@/app/data/journal'
import { SITE } from '@/app/data/site'

/**
 * The journal listing. A server component, so when this is pointed at Sanity
 * the fetch happens on the server and nothing changes in the markup.
 */
export async function Journal() {
  const posts = await getPosts()

  return (
    <section className="mx-auto max-w-[86rem] px-gutter py-section">
      {posts.length === 0 ? (
        /* An honest empty state. Three invented articles would be the fastest
           possible way to make this site look automated. */
        <div className="border border-dashed border-rule p-12 text-center">
          <p className="font-mono text-micro uppercase tracking-label text-accent">
            First post coming
          </p>
          <p className="mx-auto mt-4 max-w-[44ch] text-lead text-ink-soft">
            We&rsquo;re writing the first few now. If there is something you
            want explained — duty, shipping times, what an auction
            grade actually means — ask and we&rsquo;ll write that one first.
          </p>
          <a
            href={`mailto:${SITE.email}`}
            className="mt-8 inline-block border-b border-accent pb-1 font-mono text-micro uppercase tracking-label transition-colors hover:text-accent"
          >
            Suggest a topic
          </a>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <article className="group flex h-full flex-col">
                {post.image && (
                  <div className="relative mb-6 aspect-16/10 overflow-hidden bg-paper-sunk">
                    <Image
                      src={post.image}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-105"
                    />
                  </div>
                )}
                {post.tags?.length ? (
                  <p className="font-mono text-micro uppercase tracking-label text-accent">
                    {post.tags[0]}
                  </p>
                ) : null}
                <h3 className="mt-3 text-h4 font-semibold">{post.title}</h3>
                <p className="mt-3 text-ink-soft">{post.excerpt}</p>
                <p className="mt-auto pt-5 font-mono text-micro uppercase tracking-label text-ink-faint">
                  {post.author}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
