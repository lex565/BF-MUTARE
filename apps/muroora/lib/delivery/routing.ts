/**
 * Road-network routing, and the service area.
 *
 * THE ONE RULE IN THIS FILE: there is no straight-line fallback. Not as a
 * default, not "just for development", not behind a flag. The handoff states
 * it twice and it is worth stating a third time, because the temptation is
 * real - a straight line between two Mutare pins is trivial to compute and
 * looks plausible in a test. It is also wrong in the direction that costs
 * money: Mutare sits in a valley with a river, a railway and a mountain
 * through it, so the road between two points 3 km apart is routinely 6, and a
 * straight-line quote silently underprices exactly the deliveries that are
 * hardest to make. When there is no route, the answer is NO_NETWORK_ROUTE and
 * checkout stops.
 *
 * WHY A PROVIDER INTERFACE RATHER THAN ONE ROUTING CALL
 *
 * The handoff asks for an abstraction, and the reason is procurement, not
 * neatness. Nobody has chosen a router yet. A hosted OSRM, a self-hosted one
 * fed by the Mutare OSM extract already in qgis_musuwo/data, or a commercial
 * API are all live options with different costs and different privacy
 * consequences - a hosted router means every customer's home coordinates are
 * sent to a third party, which is a decision the owner should make knowingly.
 * So the shape is fixed here and the choice is an environment variable.
 */

import type { ServiceabilityReason } from './tariff'

/** A point on the ground. Degrees, WGS84, the way a phone reports them. */
export interface LatLng {
  readonly latitude: number
  readonly longitude: number
}

export interface RouteResult {
  readonly ok: true
  /** Road distance, whole metres. The tariff will refuse anything else. */
  readonly distanceMetres: number
  readonly durationSeconds: number
  /** Which service and which data answered, recorded on the order. */
  readonly provider: string
  readonly dataVersion: string | null
}

export interface RouteFailure {
  readonly ok: false
  readonly reason: Extract<
    ServiceabilityReason,
    'NO_NETWORK_ROUTE' | 'INVALID_LOCATION'
  >
  /** For the operator's log, never shown to a customer. */
  readonly detail: string
  readonly provider: string
}

export type RouteOutcome = RouteResult | RouteFailure

export interface RouteProvider {
  readonly name: string
  route(from: LatLng, to: LatLng): Promise<RouteOutcome>
}

/* ------------------------------------------------------- coordinate checks */

/**
 * Is this a coordinate at all?
 *
 * Zero, zero deserves its own mention: it is a real place in the Gulf of
 * Guinea and it is what an uninitialised form field looks like. A missing pin
 * arriving as (0, 0) would otherwise be routed, fail to find a road, and be
 * reported as NO_NETWORK_ROUTE - which sends the operator looking at the
 * router when the actual fault is a client that never captured a location.
 */
export function isValidLatLng(point: LatLng | null | undefined): point is LatLng {
  if (!point) return false
  const { latitude, longitude } = point
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (latitude < -90 || latitude > 90) return false
  if (longitude < -180 || longitude > 180) return false
  if (latitude === 0 && longitude === 0) return false
  return true
}

/* ------------------------------------------------------------ service area */

/** A closed ring of [longitude, latitude] pairs, GeoJSON order. */
export type Ring = readonly (readonly [number, number])[]

export interface ServiceArea {
  readonly enabled: boolean
  readonly name: string
  readonly rings: readonly Ring[]
}

/**
 * The Mutare envelope produced by the QGIS simulation, as a starting value.
 *
 * PROVISIONAL, AND SWITCHED OFF BY DEFAULT. Read the corners: three of the
 * four sides are dead straight at longitude 32.55, longitude 32.675 and
 * latitude -19.1. That is not a boundary anybody surveyed, it is where the
 * simulation clipped the national ADM2 polygon, and the simulation's own
 * README says so - "SIMULATED urban operating envelope", "not a surveyed city
 * operating boundary".
 *
 * It matters because the eastern cut at 32.675 passes about 400 metres east of
 * the Mutare CBD. Enforcing this shape as the operating area would refuse real
 * customers on the far side of an arbitrary line while looking, in the logs,
 * exactly like a correct OUTSIDE_SERVICE_AREA decision.
 *
 * So the gate is built, tested and configurable, and ships disabled. Until
 * somebody draws the real operating area, range is enforced by the thing that
 * was actually approved: the tariff's 15 km limit on road distance. Replace
 * the polygon in `platform_settings.delivery_service_area` and set enabled
 * true; no deploy is needed.
 */
export const MUTARE_SIMULATION_ENVELOPE: ServiceArea = {
  enabled: false,
  name: 'Mutare simulation envelope (provisional)',
  rings: [
    [
      [32.55664, -18.97262],
      [32.56142, -18.97255],
      [32.56231, -18.96887],
      [32.56129, -18.96476],
      [32.56075, -18.96111],
      [32.56025, -18.9602],
      [32.56831, -18.95642],
      [32.58599, -18.9557],
      [32.60127, -18.95456],
      [32.61753, -18.95432],
      [32.62661, -18.95419],
      [32.63279, -18.95227],
      [32.64277, -18.94891],
      [32.65228, -18.94557],
      [32.65494, -18.94486],
      [32.66322, -18.94265],
      [32.67368, -18.93975],
      [32.675, -18.93959],
      [32.675, -19.1],
      [32.55, -19.1],
      [32.55, -18.97238],
      [32.55664, -18.97262],
    ],
  ],
}

/**
 * Point in polygon, by ray casting.
 *
 * Plane geometry on degrees, which is accurate enough for a boundary a few
 * kilometres across and has no dependency. It is NOT used for distance -
 * distance comes from the router, in metres, along roads.
 */
export function isInsideArea(point: LatLng, area: ServiceArea): boolean {
  if (!area.enabled) return true
  return area.rings.some((ring) => ringContains(ring, point))
}

function ringContains(ring: Ring, point: LatLng): boolean {
  const { longitude: x, latitude: y } = point
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]

    const straddles = yi > y !== yj > y
    if (!straddles) continue

    const crossingX = ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (x < crossingX) inside = !inside
  }

  return inside
}

/* ---------------------------------------------------------------- provider */

/**
 * No router configured.
 *
 * Returns NO_NETWORK_ROUTE for everything, which stops checkout rather than
 * guessing a fee. That is the correct behaviour and it is also loud: the whole
 * point is that nobody can ship a delivery fee without deciding where the
 * distance comes from.
 */
export class UnconfiguredRouteProvider implements RouteProvider {
  readonly name = 'unconfigured'

  async route(): Promise<RouteOutcome> {
    return {
      ok: false,
      reason: 'NO_NETWORK_ROUTE',
      detail:
        'No routing service is configured. Set DELIVERY_ROUTING_URL to an ' +
        'OSRM-compatible endpoint. Delivery quotes are refused until then - ' +
        'a straight-line distance is never substituted.',
      provider: this.name,
    }
  }
}

/**
 * An OSRM-compatible router.
 *
 * OSRM is the interface rather than a vendor: the same request shape is served
 * by the open-source engine (which can be fed the Mutare OSM extract sitting
 * in qgis_musuwo/data and self-hosted, keeping customer coordinates in-house)
 * and by several hosted providers. Point DELIVERY_ROUTING_URL at whichever.
 *
 * The public demo server at router.project-osrm.org is NOT a production
 * option: it forbids commercial use, it is rate limited, and it would receive
 * the home coordinates of every Musuwo customer.
 */
export class OsrmRouteProvider implements RouteProvider {
  readonly name = 'osrm'

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 5_000,
    private readonly profile = 'driving',
  ) {}

  async route(from: LatLng, to: LatLng): Promise<RouteOutcome> {
    const coords =
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`
    const url =
      `${this.baseUrl.replace(/\/$/, '')}/route/v1/${this.profile}/${coords}` +
      `?overview=false&alternatives=false`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(url, { signal: controller.signal })
      /* Cleared as soon as the answer is in. Without this the timer stays
         pending for the full timeout after every SUCCESSFUL request, which
         keeps Node's event loop alive - a script that quotes one delivery
         then sits for five seconds before exiting, for no visible reason. */
      clearTimeout(timer)

      if (!response.ok) {
        return {
          ok: false,
          reason: 'NO_NETWORK_ROUTE',
          detail: `Routing service answered HTTP ${response.status}.`,
          provider: this.name,
        }
      }

      const body = (await response.json()) as {
        code?: string
        routes?: { distance?: number; duration?: number }[]
      }

      // OSRM says NoRoute when the points cannot be joined by road, and
      // NoSegment when a point is nowhere near one. Both are real answers.
      if (body.code !== 'Ok' || !body.routes?.length) {
        return {
          ok: false,
          reason: body.code === 'NoSegment' ? 'INVALID_LOCATION' : 'NO_NETWORK_ROUTE',
          detail: `Routing service returned code ${body.code ?? 'none'}.`,
          provider: this.name,
        }
      }

      const [route] = body.routes
      const distance = route.distance
      const duration = route.duration

      if (typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0) {
        return {
          ok: false,
          reason: 'NO_NETWORK_ROUTE',
          detail: `Routing service returned distance ${String(distance)}.`,
          provider: this.name,
        }
      }

      return {
        ok: true,
        // Rounded, never truncated: the tariff bands turn on single metres.
        distanceMetres: Math.round(distance),
        durationSeconds: Math.round(
          typeof duration === 'number' && Number.isFinite(duration) ? duration : 0,
        ),
        provider: this.name,
        dataVersion: response.headers.get('x-osrm-data-version'),
      }
    } catch (error) {
      clearTimeout(timer)
      const aborted = error instanceof Error && error.name === 'AbortError'
      return {
        ok: false,
        reason: 'NO_NETWORK_ROUTE',
        detail: aborted
          ? `Routing service did not answer within ${this.timeoutMs}ms.`
          : `Routing service call failed: ${(error as Error).message}`,
        provider: this.name,
      }
    }
  }
}

/**
 * The router this deployment uses.
 *
 * Built once per process. An unset DELIVERY_ROUTING_URL gives the unconfigured
 * provider, which refuses every quote - deliberately.
 */
let cached: RouteProvider | null = null

export function routeProvider(): RouteProvider {
  if (cached) return cached

  const url = process.env.DELIVERY_ROUTING_URL?.trim()
  const timeout = Number(process.env.DELIVERY_ROUTING_TIMEOUT_MS ?? 5_000)
  const profile = process.env.DELIVERY_ROUTING_PROFILE?.trim() || 'driving'

  cached = url
    ? new OsrmRouteProvider(url, Number.isFinite(timeout) ? timeout : 5_000, profile)
    : new UnconfiguredRouteProvider()

  return cached
}

/** Tests and scripts replace the provider through this. */
export function setRouteProvider(provider: RouteProvider | null): void {
  cached = provider
}
