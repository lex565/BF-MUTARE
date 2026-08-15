import type { MetadataRoute } from 'next'
import { siteUrl } from '@pineberry/ui'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${siteUrl('speed-motors')}/sitemap.xml`,
  }
}
