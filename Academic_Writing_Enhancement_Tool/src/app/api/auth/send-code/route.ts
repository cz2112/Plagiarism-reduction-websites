import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { sendOtpEmail } from '@/lib/mailer'
import { sendOtpSms } from '@/lib/sms'
import { hashOtp } from '@/lib/otp'

const sendCodeSchema = z.object({
  target: z.string(),
  channel: z.enum(['email', 'sms']),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = sendCodeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'INVALID_PARAMS', message: '参数错误' }, { status: 400 })
  }

  const channel = parsed.data.channel
  const target = parsed.data.target.trim().toLowerCase()

  // 邮箱格式校验
  if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
    return NextResponse.json({ ok: false, code: 'INVALID_EMAIL', message: '邮箱格式不正确' }, { status: 400 })
  }

  // 手机号格式校验（中国大陆 11 位）
  if (channel === 'sms' && !/^1[3-9]\d{9}$/.test(target)) {
    return NextResponse.json({ ok: false, code: 'INVALID_PHONE', message: '手机号格式不正确' }, { status: 400 })
  }

  // 频率限制：同一 IP 每分钟最多 5 次
  const ip = getClientIp(req)
  const ipLimit = await rateLimit(`send-code:ip:${ip}`, 5, 60)
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' },
      { status: 429 },
    )
  }

  // 频率限制：同一目标 60 秒只能发一次
  const targetLimit = await rateLimit(`send-code:target:${target}`, 1, 60)
  if (!targetLimit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'RATE_LIMITED', message: `请 ${targetLimit.resetSeconds} 秒后再试` },
      { status: 429 },
    )
  }

  // 生成 6 位验证码
  const code = randomInt(100000, 1000000).toString()
  const expiresAt = new Date(Date.now() + parseInt(process.env.OTP_EXPIRE_MINUTES ?? '10') * 60 * 1000)

  // 查找或创建用户
  let user = await prisma.user.findFirst({
    where: channel === 'email' ? { email: target } : { phone: target },
  })

  if (!user) {
    user = await prisma.user.create({
      data: channel === 'email' ? { email: target } : { phone: target },
    })
    // 新用户不在此处发放免费额度，在首次登录成功时处理
  }

  // 作废旧验证码
  await prisma.otpCode.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  })

  await prisma.otpCode.create({
    data: { userId: user.id, code: hashOtp(target, code), channel, target, expiresAt },
  })

  // 实际发送
  try {
    if (channel === 'email') {
      await sendOtpEmail(target, code)
    } else {
      await sendOtpSms(target, code)
    }
  } catch (err) {
    console.error('[send-code] 发送失败', err)
    return NextResponse.json(
      { ok: false, code: 'SEND_FAILED', message: '验证码发送失败，请稍后再试' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, data: null })
}
