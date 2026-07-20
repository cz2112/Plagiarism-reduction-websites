import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { grantFreeQuota } from '@/lib/billing'

const verifySchema = z.object({
  target: z.string(),
  channel: z.enum(['email', 'sms']),
  code: z.string().length(6),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'INVALID_PARAMS', message: '参数错误' }, { status: 400 })
  }

  const { target, channel, code } = parsed.data

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
