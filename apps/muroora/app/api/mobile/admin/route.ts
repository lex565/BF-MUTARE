import { mobileAdmin, mobileFail, mobileOk, mobileOptions } from '../_lib'
import { getStaffDashboard } from '@/lib/services/dashboard'
import { listAdminProducts } from '@/lib/services/products'
import { listDispatchQueue, listHandoverQueue, listRidersForAdmin } from '@/lib/services/riders'

export const dynamic = 'force-dynamic'
export const OPTIONS = mobileOptions

export async function GET(request: Request) {
  const admin = await mobileAdmin(request)
  if (!admin) return mobileFail('FORBIDDEN', 'Administrator access is required.', 403)
  const [dashboard, products, riders, dispatch, handovers] = await Promise.all([
    getStaffDashboard(admin.id, null),
    listAdminProducts(),
    listRidersForAdmin(),
    listDispatchQueue(),
    listHandoverQueue(),
  ])
  return mobileOk({
    summary: {
      ordersWaiting: dashboard.orders.waiting,
      beingPacked: dashboard.orders.beingPacked,
      onTheWay: dashboard.orders.onTheWay,
      deliveredThisWeek: dashboard.orders.deliveredThisWeek,
      products: dashboard.stock.products,
      lowOrOut: dashboard.stock.lowOrOut,
      riderApplications: riders.filter((r) => ['APPLICATION', 'UNDER_REVIEW'].includes(r.accountStatus)).length,
      openIncidents: riders.reduce((total, rider) => total + rider.incidentCount, 0),
    },
    products: products.map((p) => ({
      id: p.id, name: p.name, sku: p.sku, quantity: p.quantity, reserved: p.reserved,
      lowStockThreshold: p.lowStockThreshold, isActive: p.isActive, availability: p.availability,
      price: { amount: p.price.amount.toString(), currency: p.price.currency },
    })),
    riders: riders.map((r) => ({
      id: r.id, publicRiderId: r.publicRiderId, displayName: r.displayName,
      accountStatus: r.accountStatus, verificationStatus: r.verificationStatus,
      availability: r.availability, trustLevel: r.trustLevel,
      currentExposureAmount: r.currentExposureAmount.toString(),
      maximumExposureAmount: (r.maxExposureOverrideAmount ?? r.trustExposureLimitAmount)?.toString() ?? null,
      currency: r.currency, activeDeliveries: r.activeDeliveries,
      completedDeliveries: r.completedDeliveries, incidentCount: r.incidentCount,
    })),
    dispatch: dispatch.map((d) => ({
      ...d,
      merchandiseValueAmount: d.merchandiseValueAmount.toString(),
      createdAt: d.createdAt.toISOString(),
    })),
    handovers: handovers.map((h) => ({
      ...h,
      merchandiseValueAmount: h.merchandiseValueAmount.toString(),
      assignedAt: h.assignedAt?.toISOString() ?? null,
    })),
  })
}
