import { NextRequest, NextResponse } from 'next/server'
import { handlePaymentCallback } from '@/lib/payment/wechat'

// POST /api/payment/callback — 微信支付回调
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await handlePaymentCallback(body)
    return NextResponse.json({ code: 'SUCCESS', message: 'OK' })
  } catch (err) {
    console.error('[Payment Callback]', err)
    return NextResponse.json(
      { code: 'FAIL', message: '处理失败' },
      { status: 500 },
    )
  }
}
