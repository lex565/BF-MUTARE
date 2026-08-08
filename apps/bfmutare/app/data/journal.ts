/**
 * The journal — BF Mutare's blog.
 *
 * ── WHERE THE POSTS WILL COME FROM ────────────────────────────────────────
 * You picked Sanity, so this file is shaped to be a drop-in stand-in for it:
 * `getPosts()` is the only thing the UI calls, and swapping the body of that
 * function for a Sanity query is the entire migration. Nothing in the
 * components needs to change.
 *
 * That wiring needs a Sanity project ID and dataset, which only you can create
 * (sanity.io → new project, free tier). Send those and I'll connect it.
 *
 * ── UNTIL THEN ────────────────────────────────────────────────────────────
 * POSTS is empty, and the section renders an honest empty state rather than
 * three fake articles about "5 Tips For Importing Your Dream Car". Add an
 * entry here and it appears immediately.
 */

export interface Post {
  slug: string
  title: string
  /** One-line standfirst shown in the listing. */
  excerpt: string
  /** ISO date. Only shown once there are enough posts to warrant it. */
  date: string
  author: string
  /** Optional lead image, e.g. '/deliveries/delivery-04.jpeg'. */
  image?: string | null
  /** Plain paragraphs for now; Sanity will supply portable text later. */
  body: string[]
  tags?: string[]
}

export const POSTS: Post[] = []

/**
 * The single seam between the UI and wherever content lives.
 * Async on purpose — so switching to Sanity does not change any call site.
 */
export async function getPosts(): Promise<Post[]> {
  return POSTS
}

export async function getPost(slug: string): Promise<Post | undefined> {
  return POSTS.find((post) => post.slug === slug)
}
