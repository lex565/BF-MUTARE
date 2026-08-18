import { getPublicBusiness } from '@/lib/services/marketplace'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const business = await getPublicBusiness(slug)
  if (!business) return new Response('Not found', { status: 404 })
  const initials = business.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#17372d"/><text x="32" y="39" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="24" fill="#ffb37a">${initials}</text></svg>`
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' } })
}
