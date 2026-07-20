import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'
import { createNativeOrder } from '@/lib/payment/wechat'

const createOrderSchema = z.object({
  packageId: z.string(),
})

// POST /api/payment/create — 创建支付订单
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const body = await req.json()
  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'INVALID_PARAMS' }, { status: 400 })
  }

  const pkg = await prisma.package.findFirst({
    where: { id: parsed.data.packageId, active: true },
  })

  if (!pkg) {
    return NextResponse.json({ ok: false, code: 'PACKAGE_NOT_FOUND' }, { status: 404 })
  }

  const order = await prisma.order.create({
    data: {
      userId,
      packageId: pkg.id,
      priceFen: pkg.priceFen,
      chars: pkg.chars,
      status: 'pending',
    },
  })

  // 调用微信支付统一下单（NATIVE 扫码）
  const payResult = await createNativeOrder({
    orderId: order.id,
    description: `文清AI - ${pkg.name}`,
    totalFee: pkg.priceFen,
    tradeType: 'NATIVE',
  })

  // 保存 prepayId
  await prisma.order.update({
    where: { id: order.id },
    data: { wxPrepayId: payResult.prepayId },
  })

  return NextResponse.json({
    ok: true,
    data: {
      orderId: order.id,
      codeUrl: payResult.codeUrl, // 二维码链接
    },
  })
}
