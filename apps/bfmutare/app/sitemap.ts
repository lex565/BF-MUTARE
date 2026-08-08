import type { MetadataRoute } from 'next'

/**
 * Kept in step with the routes by hand — there are six of them and they change
 * rarely. If per-vehicle pages get added later, generate that part from
 * FEATURED rather than listing them here.
 */
const BASE = 'https://bfmutare.co.zw' // TODO: confirm domain

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
