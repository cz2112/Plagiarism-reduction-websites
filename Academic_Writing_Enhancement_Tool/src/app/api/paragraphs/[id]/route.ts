import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'

const patchSchema = z.object({
  action: z.enum(['accept', 'revert', 'edit']),
  editedText: z.string().optional(), // action=edit 时传入
})

// PATCH /api/paragraphs/[id] — 接受/撤销/手动编辑修改结果
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'INVALID_PARAMS' }, { status: 400 })
  }

  const { action, editedText } = parsed.data

  const paragraph = await prisma.paragraph.findFirst({
    where: {
      id: params.id,
      project: { userId },
    },
    include: {
      tasks: {
        where: { status: 'done' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!paragraph) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })
  }

  if (action === 'accept') {
    const latestDoneTask = paragraph.tasks[0]
    if (!latestDoneTask?.result) {
      return NextResponse.json(
        { ok: false, code: 'NO_RESULT', message: '没有可接受的结果' },
        { status: 400 },
      )
    }

    await prisma.paragraph.update({
      where: { id: params.id },
      data: { activeResult: latestDoneTask.result, status: 'accepted' },
    })
  } else if (action === 'edit') {
    if (!editedText?.trim()) {
      return NextResponse.json({ ok: false, code: 'MISSING_TEXT' }, { status: 400 })
    }
    await prisma.paragraph.update({
      where: { id: params.id },
      data: { activeResult: editedText.trim(), status: 'accepted' },
    })
  } else if (action === 'revert') {
    await prisma.paragraph.update({
      where: { id: params.id },
      data: { activeResult: null, status: 'pending' },
    })
  }

  return NextResponse.json({ ok: true, data: null })
}
