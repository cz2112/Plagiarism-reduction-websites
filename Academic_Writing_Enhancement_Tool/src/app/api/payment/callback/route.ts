import { NextRequest, NextResponse } from 'next/server'
import { handlePaymentCallback, CallbackHeaders } from '@/lib/payment/wechat'

// POST /api/payment/callback — 微信支付回调
export async function POST(req: NextRequest) {
  try {
    // 必须拿原始报文验签，不能用 req.json() 后再序列化（字段顺序/空格会变）
    const rawBody = await req.text()

    const headers: CallbackHeaders = {
      timestamp: req.headers.get('Wechatpay-Timestamp') ?? '',
      nonce: req.headers.get('Wechatpay-Nonce') ?? '',
      signature: req.headers.get('Wechatpay-Signature') ?? '',
      serial: req.headers.get('Wechatpay-Serial') ?? '',
    }

    if (!headers.timestamp || !headers.nonce || !headers.signature) {
      return NextResponse.json({ code: 'FAIL', message: '缺少签名头' }, { status: 401 })
    }

    await handlePaymentCallback(headers, rawBody)
    return NextResponse.json({ code: 'SUCCESS', message: 'OK' })
  } catch (err) {
    console.error('[Payment Callback]', err)
    // 验签失败返回 401，微信会重试
    const msg = err instanceof Error ? err.message : '处理失败'
    const isAuthErr = msg.includes('签名')
    return NextResponse.json(
      { code: 'FAIL', message: msg },
      { status: isAuthErr ? 401 : 500 },
    )
  }
}
