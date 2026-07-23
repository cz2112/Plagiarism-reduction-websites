/**
 * 微信支付 V3 适配
 * 使用原生 fetch 调用微信支付 API，避免引入重型 SDK
 */

import { createSign, createVerify, createDecipheriv, randomUUID } from 'crypto'
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

// ── 回调验签与解密 ─────────────────────────────────────

export interface CallbackHeaders {
  timestamp: string
  nonce: string
  signature: string
  serial: string
}

interface WechatResource {
  ciphertext: string
  nonce: string
  associated_data?: string
  algorithm: string
}

/** 验证微信回调签名（使用微信支付平台证书公钥）*/
export function verifyCallbackSignature(headers: CallbackHeaders, rawBody: string): boolean {
  const certPath = process.env.WECHAT_PLATFORM_CERT_PATH
  if (!certPath) {
    throw new Error('WECHAT_PLATFORM_CERT_PATH 未配置，无法验签')
  }
  const publicKey = fs.readFileSync(certPath, 'utf8')

  // 构造验签串：timestamp\n nonce\n body\n
  const message = `${headers.timestamp}\n${headers.nonce}\n${rawBody}\n`

  const verify = createVerify('SHA256withRSA')
  verify.update(message)
  return verify.verify(publicKey, headers.signature, 'base64')
}

/** 解密回调 resource（AES-256-GCM）*/
function decryptResource(resource: WechatResource): string {
  const key = process.env.WECHAT_APIV3_KEY
  if (!key || key.length !== 32) {
    throw new Error('WECHAT_APIV3_KEY 未配置或长度不为 32')
  }

  const ciphertextBuf = Buffer.from(resource.ciphertext, 'base64')
  // GCM 认证标签为密文末尾 16 字节
  const authTag = ciphertextBuf.subarray(ciphertextBuf.length - 16)
  const data = ciphertextBuf.subarray(0, ciphertextBuf.length - 16)

  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), Buffer.from(resource.nonce, 'utf8'))
  decipher.setAuthTag(authTag)
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'))
  }

  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/**
 * 处理支付回调
 * 先验签，再解密 resource，提取 out_trade_no 并入账
 */
export async function handlePaymentCallback(
  headers: CallbackHeaders,
  rawBody: string,
): Promise<void> {
  // 1. 验签
  if (!verifyCallbackSignature(headers, rawBody)) {
    throw new Error('回调签名验证失败')
  }

  const body = JSON.parse(rawBody) as { resource?: WechatResource }
  const resource = body.resource
  if (!resource) throw new Error('回调缺少 resource')

  // 2. 解密
  const decrypted = decryptResource(resource)
  const payload = JSON.parse(decrypted) as {
    out_trade_no: string
    trade_state: string
    transaction_id?: string
  }

  const outTradeNo = payload.out_trade_no
  if (!outTradeNo) throw new Error('解密结果缺少 out_trade_no')

  // 3. 仅在支付成功状态入账
  if (payload.trade_state !== 'SUCCESS') return

  const order = await prisma.order.findUnique({
    where: { id: outTradeNo },
    include: { package: true },
  })

  if (!order || order.status !== 'pending') return // 幂等：非 pending 直接跳过

  // 记录微信交易号
  if (payload.transaction_id) {
    await prisma.order.update({
      where: { id: order.id },
      data: { wxTransactionId: payload.transaction_id },
    })
  }

  await addCredits(order.userId, order.id, order.chars)
}
