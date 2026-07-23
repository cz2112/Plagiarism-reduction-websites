/**
 * 邮件发送（验证码）
 * 使用 nodemailer + SMTP。开发环境未配置 SMTP 时降级为控制台打印。
 */
import nodemailer, { Transporter } from 'nodemailer'

let _transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter
  const host = process.env.SMTP_HOST
  if (!host) return null // 未配置，交由调用方降级处理

  _transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? '465'),
    secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  return _transporter
}

/** 发送验证码邮件；返回是否真实发出（false 表示降级为日志） */
export async function sendOtpEmail(to: string, code: string): Promise<boolean> {
  const transporter = getTransporter()
  const minutes = process.env.OTP_EXPIRE_MINUTES ?? '10'

  if (!transporter) {
    // 未配置 SMTP：开发环境打印，生产环境抛错以免静默失败
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP_NOT_CONFIGURED')
    }
    console.log(`[OTP][email] ${to}: ${code}`)
    return false
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: '【文清AI】登录验证码',
    text: `您的验证码是 ${code}，${minutes} 分钟内有效。如非本人操作请忽略。`,
    html: `<div style="font-family:sans-serif;font-size:15px;color:#333">
      <p>您的验证码是：</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#111">${code}</p>
      <p style="color:#888">${minutes} 分钟内有效。如非本人操作请忽略此邮件。</p>
    </div>`,
  })
  return true
}
