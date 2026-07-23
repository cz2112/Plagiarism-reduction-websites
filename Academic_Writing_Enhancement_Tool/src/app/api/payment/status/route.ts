import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'

// GET /api/payment/status?orderId=xxx — 前端轮询订单支付状态
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) {
    return NextResponse.json({ ok: false, code: 'INVALID_PARAMS' }, { status: 400 })
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, status: true, chars: true, paidAt: true },
  })

  if (!order) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    data: {
      orderId: order.id,
      status: order.status, // pending | paid | ...
      chars: order.chars,
      paidAt: order.paidAt?.toISOString() ?? null,
    },
  })
}
