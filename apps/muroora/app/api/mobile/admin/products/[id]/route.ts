import { z } from 'zod'

import { applyStockMove } from '@/lib/inventory'
import { setProductActive } from '@/lib/services/products'
import { mobileAdmin, mobileFail, mobileOk, mobileOptions } from '../../../_lib'

export const OPTIONS = mobileOptions

const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('SET_ACTIVE'), isActive: z.boolean() }).strict(),
  z.object({
    action: z.literal('ADJUST_STOCK'),
    change: z.number().int().refine((value) => value !== 0),
    type: z.enum(['RESTOCK', 'DAMAGED', 'LOST', 'RETURN', 'MANUAL_ADJUSTMENT']),
    reason: z.string().trim().min(3).max(300),
  }).strict(),
])

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await mobileAdmin(request)
  if (!admin) return mobileFail('FORBIDDEN', 'Administrator access is required.', 403)
  let body: unknown
  try { body = await request.json() } catch { return mobileFail('BAD_REQUEST', 'Expected a product action.', 400) }
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return mobileFail('BAD_REQUEST', 'That product change is not valid.', 400)
  const { id } = await params
  try {
    if (parsed.data.action === 'SET_ACTIVE') {
      await setProductActive(id, parsed.data.isActive, admin.id)
      return mobileOk({ isActive: parsed.data.isActive })
    }
    const stock = await applyStockMove({
      storeId: process.env.NEXT_PUBLIC_STORE_ID!, productId: id,
      type: parsed.data.type, quantityChange: parsed.data.change,
      reason: parsed.data.reason, referenceType: 'mobile_admin_adjustment', performedBy: admin.id,
    })
    return mobileOk({ quantity: stock.quantityAfter })
  } catch (error) {
    return mobileFail('CONFLICT', String((error as Error).message).slice(0, 200), 409)
  }
}
