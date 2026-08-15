import type { MetadataRoute } from 'next'
import { siteUrl } from '@pineberry/ui'

/**
 * Kept in step with the routes by hand — there are six of them and they change
 * rarely. If per-vehicle pages get added later, generate that part from
 * FEATURED rather than listing them here.
 *
 * The base was hardcoded to https://bfmutare.co.zw, which does not resolve, so
 * every URL in this sitemap pointed at a domain that does not exist. Now read
 * from the shared brand record.
 */
const BASE = siteUrl('bf-mutare')

const ROUTES: Array<{ path: string; priority: number }> = [
  { path: '', priority: 1 },
  { path: '/deliveries', priority: 0.9 },
  { path: '/contact', priority: 0.9 },
  { path: '/about', priority: 0.7 },
  { path: '/team', priority: 0.6 },
  { path: '/journal', priority: 0.6 },
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
