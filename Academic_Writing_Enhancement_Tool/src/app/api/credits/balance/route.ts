import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'

// GET /api/credits/balance — 获取余额
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, freeUsed: true },
  })

  if (!user) return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })

  return NextResponse.json({
    ok: true,
    data: { credits: user.credits, freeUsed: user.freeUsed },
  })
}
