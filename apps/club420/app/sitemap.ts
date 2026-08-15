import type { MetadataRoute } from 'next'
import { siteUrl } from '@pineberry/ui'

/**
 * Base URL comes from the shared brand record, never a literal — the two older
 * apps had theirs hardcoded to domains that do not resolve, which put every
 * sitemap URL on a host that does not exist.
 */
const BASE = siteUrl('club-420')

const ROUTES: Array<{ path: string; priority: number }> = [
  { path: '', priority: 1.0 },
  { path: '/range', priority: 0.9 },
  { path: '/experiences', priority: 0.8 },
  { path: '/story', priority: 0.7 },
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
