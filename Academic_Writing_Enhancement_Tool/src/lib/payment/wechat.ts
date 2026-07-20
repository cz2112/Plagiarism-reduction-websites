/**
 * 微信支付 V3 适配
 * 使用原生 fetch 调用微信支付 API，避免引入重型 SDK
 */

import { createHash, createSign, randomUUID } from 'crypto'
import fs from 'fs'
import { prisma } from '../db'
import { addCredits } from '../billing'

interface UnifiedOrderParams {
  orderId: string
  description: string
  totalFee: number   // 分
  openId?: string    // JSAPI 支付需要
  tradeType: 'JSAPI' | 'NATIVE'
}

interface PrepayResult {
  prepayId: string
  codeUrl?: string   // NATIVE 扫码链接
  jsApiParams?: JSAPIPayParams
}

interface JSAPIPayParams {
  appId: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

function getPrivateKey(): string {
  return fs.readFileSync(process.env.WECHAT_PRIVATE_KEY_PATH as string, 'utf8')
}

/** 生成请求签名 */
function sign(message: string): string {
  const sign = createSign('SHA256withRSA')
  sign.update(message)
  return sign.sign(getPrivateKey(), 'base64')
}

/** 构建 Authorization 头 */
function buildAuthHeader(method: string, url: string, body: string): string {
  const appId = process.env.WECHAT_APP_ID!
  const mchId = process.env.WECHAT_MCH_ID!
  const serialNo = process.env.WECHAT_SERIAL_NO!
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomUUID().replace(/-/g, '')

  const parsedUrl = new URL(url)
  const canonicalUrl = parsedUrl.pathname + (parsedUrl.search || '')
  const message = `${method}\n${canonicalUrl}\n${timestamp}\n${nonce}\n${body}\n`
  const signature = sign(message)

  return (
    `WECHATPAY2-SHA256-RSA2048 ` +
    `mchid="${mchId}",nonce_str="${nonce}",timestamp="${timestamp}",` +
    `serial_no="${serialNo}",signature="${signature}"`
  )
}

/** 统一下单（NATIVE 扫码） */
export async function createNativeOrder(params: UnifiedOrderParams): Promise<PrepayResult> {
  const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/native'
  const body = JSON.stringify({
    appid: process.env.WECHAT_APP_ID,
    mchid: process.env.WECHAT_MCH_ID,
    description: params.description,
    out_trade_no: params.orderId,
    notify_url: process.env.WECHAT_NOTIFY_URL,
    amount: { total: params.totalFee, currency: 'CNY' },
  })

  const authHeader = buildAuthHeader('POST', url, body)
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body,
  })

  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(`WeChat Pay error: ${JSON.stringify(err)}`)
  }

  const data = await resp.json() as { code_url: string; prepay_id: string }
  return { prepayId: data.prepay_id, codeUrl: data.code_url }
}

/**
 * 处理支付回调
 * 注意：实际使用时需要验证微信的回调签名
 */
export async function handlePaymentCallback(body: Record<string, unknown>): Promise<void> {
  // TODO: 验证回调签名（使用微信平台证书公钥）
  const resource = body.resource as Record<string, unknown>
  if (!resource) return

  // 解密 resource.ciphertext（AES-256-GCM）
  // 实际实现需要使用微信支付 API v3 密钥解密
  // 这里先用占位符表示流程
  const outTradeNo = '' // 从解密后的数据中提取

  if (!outTradeNo) return

  const order = await prisma.order.findUnique({
    where: { id: outTradeNo },
    include: { package: true },
  })

  if (!order || order.status !== 'pending') return

  await addCredits(order.userId, order.id, order.chars)
}
