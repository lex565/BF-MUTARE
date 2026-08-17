import { eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { staffProfiles } from '@/db/schema'
import { hasRole } from '@/lib/auth'
import { getStaffDashboard } from '@/lib/services/dashboard'
import { listOrdersForStaff } from '@/lib/services/orders'
import { listAdminProducts } from '@/lib/services/products'
import { mobileFail, mobileOk, mobileOptions, mobileUser } from '../_lib'

export const dynamic = 'force-dynamic'
export const OPTIONS = mobileOptions

export async function GET(request:Request){
  const user=await mobileUser(request)
  if(!hasRole(user,'SHOP_STAFF','ADMIN','SUPER_ADMIN','VIEWER')) return mobileFail('FORBIDDEN','Staff access has not been activated for this account.',403)
  const [profile]=await db.select({staffNumber:staffProfiles.staffNumber,jobTitle:staffProfiles.jobTitle,status:staffProfiles.status,joinedAt:staffProfiles.joinedAt,photoPath:staffProfiles.photoPath}).from(staffProfiles).where(eq(staffProfiles.userId,user!.id))
  if(!profile) return mobileFail('SETUP_REQUIRED','An administrator must add this account to the staff list.',403)
  const [dashboard,orders,products]=await Promise.all([getStaffDashboard(user!.id,null),listOrdersForStaff(),listAdminProducts()])
  return mobileOk({
    me:{fullName:user!.fullName,email:user!.email,...profile,joinedAt:profile.joinedAt.toISOString()},
    summary:{ordersWaiting:dashboard.orders.waiting,beingPacked:dashboard.orders.beingPacked,onTheWay:dashboard.orders.onTheWay,lowOrOut:dashboard.stock.lowOrOut},
    orders:orders.map(o=>({...o,placedAt:o.placedAt?.toISOString()??null,total:{amount:o.total.amount.toString(),currency:o.total.currency}})),
    products:products.map(p=>({id:p.id,name:p.name,sku:p.sku,available:p.quantity-p.reserved,availability:p.availability})),
  })
}
