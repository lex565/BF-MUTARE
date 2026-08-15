import type { MetadataRoute } from 'next'
import { siteUrl } from '@pineberry/ui'

/**
 * Base URL comes from the shared brand record, never a literal — the two older
 * apps had theirs hardcoded to domains that do not resolve, which put every
 * sitemap URL on a host that does not exist.
 */
const BASE = siteUrl('muroora-mart')

const ROUTES: Array<{ path: string; priority: number }> = [
  { path: '', priority: 1.0 },
  { path: '/diaspora', priority: 0.9 },
  { path: '/shop', priority: 0.8 },
  { path: '/about', priority: 0.6 },
  { path: '/contact', priority: 0.7 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return ROUTES.map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency: 'monthly',
    priority,
  }))
}
