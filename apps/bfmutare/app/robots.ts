import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://bfmutare.co.zw/sitemap.xml', // TODO: confirm domain
  }
}
