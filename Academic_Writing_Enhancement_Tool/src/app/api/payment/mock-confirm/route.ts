import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'
import { addCredits } from '@/lib/billing'

const schema = z.object({ orderId: z.string().min(1) })

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' || process.env.PAYMENT_MODE !== 'mock') {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })
  }

  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'INVALID_PARAMS' }, { status: 400 })
  }

  const order = await prisma.order.findFirst({
    where: { id: parsed.data.orderId, userId, status: 'pending' },
    select: { id: true, chars: true },
  })
  if (!order) {
    return NextResponse.json({ ok: false, code: 'ORDER_NOT_FOUND' }, { status: 404 })
  }

  await addCredits(userId, order.id, order.chars)
  return NextResponse.json({ ok: true, data: { orderId: order.id } })
}
