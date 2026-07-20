import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'

// GET /api/tasks/[id] — 轮询任务状态
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const task = await prisma.processTask.findFirst({
    where: { id: params.id, userId },
  })

  if (!task) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: task.id,
      status: task.status,
      result: task.result,
      validationPassed: task.validationPassed,
      errorCode: task.errorCode,
      errorMessage: task.errorMessage,
      isFreeRetry: task.isFreeRetry,
      charCount: task.charCount,
      credited: task.credited,
    },
  })
}
