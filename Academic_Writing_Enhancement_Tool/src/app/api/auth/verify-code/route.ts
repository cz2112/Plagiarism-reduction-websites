import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { grantFreeQuota } from '@/lib/billing'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { redis } from '@/lib/redis'

const verifySchema = z.object({
  target: z.string(),
  channel: z.enum(['email', 'sms']),
  code: z.string().length(6),
})

// 同一目标连续验证失败的最大次数，超过则在窗口期内锁定
const MAX_ATTEMPTS = 5
const LOCK_WINDOW_SECONDS = 15 * 60

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'INVALID_PARAMS', message: '参数错误' }, { status: 400 })
  }

  const { target, channel, code } = parsed.data

  // 防爆破：同一目标 15 分钟内失败超过 5 次则锁定
  const attemptKey = `verify:fail:${channel}:${target}`
  const attempts = await rateLimit(attemptKey, MAX_ATTEMPTS, LOCK_WINDOW_SECONDS)
  if (!attempts.allowed) {
    return NextResponse.json(
      { ok: false, code: 'TOO_MANY_ATTEMPTS', message: '验证失败次数过多，请稍后再试' },
      { status: 429 },
    )
  }

  // IP 维度限流，进一步限制枚举
  const ip = getClientIp(req)
  const ipLimit = await rateLimit(`verify:ip:${ip}`, 20, 60)
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' },
      { status: 429 },
    )
  }

  const user = await prisma.user.findFirst({
    where: channel === 'email' ? { email: target } : { phone: target },
  })

  if (!user) {
    return NextResponse.json({ ok: false, code: 'USER_NOT_FOUND', message: '用户不存在' }, { status: 404 })
  }

  const otp = await prisma.otpCode.findFirst({
    where: {
      userId: user.id,
      code,
      channel,
      target,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!otp) {
    return NextResponse.json({ ok: false, code: 'INVALID_CODE', message: '验证码无效或已过期' }, { status: 400 })
  }

  // 验证成功，清除失败计数
  await redis.del(`rl:${attemptKey}`)

  // 标记验证码已使用
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  })

  // 新用户发放免费额度
  if (!user.freeUsed) {
    await grantFreeQuota(user.id)
  }

  // 写入 Session
  const session = await getSession()
  session.userId = user.id
  await session.save()

  return NextResponse.json({ ok: true, data: { userId: user.id } })
}
