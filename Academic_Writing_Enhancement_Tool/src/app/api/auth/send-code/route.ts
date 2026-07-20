import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'

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

  const { target, channel } = parsed.data

  // 生成 6 位验证码
  const code = Math.floor(100000 + Math.random() * 900000).toString()
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
    data: { userId: user.id, code, channel, target, expiresAt },
  })

  // TODO: 实际发送邮件/短信（接入 SMTP 或短信服务）
  if (process.env.NODE_ENV === 'development') {
    console.log(`[OTP] ${channel} ${target}: ${code}`)
  }

  return NextResponse.json({ ok: true, data: null })
}
