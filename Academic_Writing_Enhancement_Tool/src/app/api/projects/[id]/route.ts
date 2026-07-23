import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'
import { normalizeMode } from '@/lib/modes'

// GET /api/projects/[id] — 获取项目详情及段落列表
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId, status: 'active' },
    include: {
      paragraphs: {
        orderBy: { index: 'asc' },
        include: {
          tasks: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  if (!project) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: project.id,
      title: project.title,
      totalChars: project.totalChars,
      createdAt: project.createdAt.toISOString(),
      paragraphs: project.paragraphs.map((p) => ({
        id: p.id,
        index: p.index,
        original: p.original,
        charCount: p.charCount,
        status: p.status,
        activeResult: p.activeResult,
        latestTask: p.tasks[0]
          ? {
              id: p.tasks[0].id,
              status: p.tasks[0].status,
              mode: normalizeMode(p.tasks[0].mode),
              lockedTerms: p.tasks[0].lockedTerms,
              result: p.tasks[0].result,
              validationPassed: p.tasks[0].validationPassed,
              errorCode: p.tasks[0].errorCode,
              errorMessage: p.tasks[0].errorMessage,
              isFreeRetry: p.tasks[0].isFreeRetry,
              fallbackAttempted: p.tasks[0].fallbackAttempted,
              fallbackUsed: p.tasks[0].fallbackUsed,
              createdAt: p.tasks[0].createdAt.toISOString(),
            }
          : null,
      })),
    },
  })
}

// DELETE /api/projects/[id] — 软删除项目
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId, status: 'active' },
  })

  if (!project) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })
  }

  await prisma.project.update({
    where: { id: params.id },
    data: { status: 'deleted', deletedAt: new Date() },
  })

  return NextResponse.json({ ok: true, data: null })
}
