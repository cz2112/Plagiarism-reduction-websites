import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'

// GET /api/credits/orders — 获取消费和充值记录
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const [usageLogs, orders] = await Promise.all([
    prisma.usageLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.order.findMany({
      where: { userId },
      include: { package: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  return NextResponse.json({
    ok: true,
    data: {
      usageLogs: usageLogs.map((l) => ({
        id: l.id,
        charCount: l.charCount,
        balanceAfter: l.balanceAfter,
        reason: l.reason,
        createdAt: l.createdAt.toISOString(),
      })),
      orders: orders.map((o) => ({
        id: o.id,
        packageName: o.package.name,
        chars: o.chars,
        priceFen: o.priceFen,
        status: o.status,
        paidAt: o.paidAt?.toISOString() ?? null,
        createdAt: o.createdAt.toISOString(),
      })),
    },
  })
}
