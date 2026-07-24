/**
 * 短信验证码发送
 * 生产环境使用阿里云短信（Dysmsapi，RPC 风格签名）；
 * 未配置时开发环境降级为控制台打印，生产环境抛错以免静默失败。
 *
 * 需要的环境变量（阿里云）：
 *   SMS_PROVIDER=aliyun
 *   ALIYUN_SMS_ACCESS_KEY_ID
 *   ALIYUN_SMS_ACCESS_KEY_SECRET
 *   ALIYUN_SMS_SIGN_NAME       短信签名（如「文清AI」）
 *   ALIYUN_SMS_TEMPLATE_CODE   模板 CODE（如 SMS_123456），模板变量需为 ${code}
 */
import { createHmac, randomUUID } from 'crypto'

/** 发送验证码短信；返回是否真实发出（false 表示降级为日志） */
export async function sendOtpSms(phone: string, code: string): Promise<boolean> {
  const provider = process.env.SMS_PROVIDER

  if (provider === 'aliyun') {
    await sendViaAliyun(phone, code)
    return true
  }

  // 未配置服务商：开发环境打印，生产环境抛错
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SMS_NOT_CONFIGURED')
  }
  console.log(`[OTP][sms] ${phone}: ${code}`)
  return false
}

// ── 阿里云短信 ────────────────────────────────────────

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~')
}

async function sendViaAliyun(phone: string, code: string): Promise<void> {
  const accessKeyId = requireEnv('ALIYUN_SMS_ACCESS_KEY_ID')
  const accessKeySecret = requireEnv('ALIYUN_SMS_ACCESS_KEY_SECRET')
  const signName = requireEnv('ALIYUN_SMS_SIGN_NAME')
  const templateCode = requireEnv('ALIYUN_SMS_TEMPLATE_CODE')

  // RPC 公共参数
  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: phone,
    RegionId: 'cn-hangzhou',
    SignName: signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: randomUUID(),
    SignatureVersion: '1.0',
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  }

  // 1. 按 key 排序后拼成规范化查询串
  const sortedKeys = Object.keys(params).sort()
  const canonical = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&')

  // 2. 构造待签名串并用 AccessKeySecret& 作为密钥做 HMAC-SHA1
  const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonical)}`
  const signature = createHmac('sha1', `${accessKeySecret}&`)
    .update(stringToSign)
    .digest('base64')

  const query = `Signature=${percentEncode(signature)}&${canonical}`
  const url = `https://dysmsapi.aliyuncs.com/?${query}`

  const resp = await fetch(url, { method: 'GET' })
  const data = (await resp.json()) as { Code?: string; Message?: string }
  if (data.Code !== 'OK') {
    throw new Error(`Aliyun SMS error: ${data.Code} ${data.Message ?? ''}`)
  }
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name}_REQUIRED`)
  return v
}
