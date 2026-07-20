import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'
import {
  countBillableChars,
  hasEnoughCredits,
  isFreeRetryAvailable,
} from '@/lib/billing'
import { processQueue } from '@/lib/queue/processor'
import type { ProcessJobData } from '@/lib/queue/processor'

const processSchema = z.object({
  paragraphId: z.string(),
  mode: z.enum(['conservative', 'polish']),
  lockedTerms: z.array(z.string()).default([]),
})

// POST /api/process — 提交段落处理任务
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const body = await req.json()
  const parsed = processSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'INVALID_PARAMS' }, { status: 400 })
  }

  const { paragraphId, mode, lockedTerms } = parsed.data

  // 验证段落归属
  const paragraph = await prisma.paragraph.findFirst({
    where: {
      id: paragraphId,
      project: { userId },
    },
    include: { project: true },
  })

  if (!paragraph) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })
  }

  // 输入长度限制：单段不超过 3000 字符
  if (paragraph.original.length > 3000) {
    return NextResponse.json(
      { ok: false, code: 'TEXT_TOO_LONG', message: '单段文本不能超过 3000 字符' },
      { status: 400 },
    )
  }

  // 若段落正在处理中，拒绝重复提交
  if (paragraph.status === 'processing') {
    return NextResponse.json(
      { ok: false, code: 'ALREADY_PROCESSING', message: '该段落正在处理中' },
      { status: 409 },
    )
  }

  const charCount = countBillableChars(paragraph.original)

  // 判断是否为免费重试
  const freeRetryAvail = await isFreeRetryAvailable(paragraphId, mode)
  const isFreeRetry = freeRetryAvail && paragraph.status === 'done'

  // 余额检查（免费重试跳过）
  if (!isFreeRetry) {
    const enough = await hasEnoughCredits(userId, charCount)
    if (!enough) {
      return NextResponse.json(
        { ok: false, code: 'INSUFFICIENT_CREDITS', message: '字数余额不足' },
        { status: 402 },
      )
    }
  }

  // 创建任务记录
  const task = await prisma.processTask.create({
    data: {
      paragraphId,
      userId,
      mode,
      lockedTerms,
      charCount,
      isFreeRetry,
      status: 'queued',
    },
  })

  // 更新段落状态
  await prisma.paragraph.update({
    where: { id: paragraphId },
    data: { status: 'processing' },
  })

  // 入队
  const jobData: ProcessJobData = {
    taskId: task.id,
    userId,
    paragraphId,
    original: paragraph.original,
    mode,
    lockedTerms,
    charCount,
    isFreeRetry,
  }

  await processQueue.add(`task-${task.id}`, jobData, {
    jobId: task.id,
  })

  return NextResponse.json({ ok: true, data: { taskId: task.id } })
}
