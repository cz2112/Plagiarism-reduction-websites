/**
 * 任务队列处理器
 * 使用 BullMQ 异步处理 AI 生成任务
 */

import { Queue, Worker, Job, ConnectionOptions } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '../db'
import { processWithAI } from '../ai/adapter'
import { deductCredits, refundCredits } from '../billing'
import type { ProcessMode } from '@/types'

// ── Redis 连接 ─────────────────────────────────────────

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // BullMQ 要求
}) as unknown as ConnectionOptions

export const PROCESS_QUEUE_NAME = 'paragraph-process'

// ── 队列实例（供 API 路由 enqueue 使用）────────────────

export const processQueue = new Queue(PROCESS_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 1,        // 我们在业务层控制重试
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})

export interface ProcessJobData {
  taskId: string
  userId: string
  paragraphId: string
  original: string
  mode: ProcessMode
  lockedTerms: string[]
  charCount: number
  isFreeRetry: boolean
}

// ── Worker（在独立进程 src/worker/index.ts 中启动）─────

export function createWorker(): Worker<ProcessJobData> {
  const worker = new Worker<ProcessJobData>(
    PROCESS_QUEUE_NAME,
    async (job: Job<ProcessJobData>) => {
      const data = job.data
      const { taskId, userId, paragraphId, original, mode, lockedTerms, charCount, isFreeRetry } =
        data

      // 标记任务为运行中
      await prisma.processTask.update({
        where: { id: taskId },
        data: { status: 'running', startedAt: new Date() },
      })

      try {
        // 调用 AI（编排层已完成：按等级选模型 → 同模型重试 → 必要时降级 → 质量校验）
        const ai = await processWithAI({ original, mode, lockedTerms })

        // 统一记录模型与用量，便于后续成本核算（无论成败）
        const usageData = {
          model: ai.model,
          provider: ai.provider,
          promptTokens: ai.usage.promptTokens,
          completionTokens: ai.usage.completionTokens,
          fallbackUsed: ai.fallbackUsed,
          fallbackAttempted: ai.fallbackAttempted,
        }

        if (!ai.validationPassed) {
          // 重试（含降级）后仍未通过校验，任务失败，不扣费
          await prisma.processTask.update({
            where: { id: taskId },
            data: {
              ...usageData,
              status: 'failed',
              result: ai.result,
              validationPassed: false,
              validationDetails: ai.validationDetails ? { details: ai.validationDetails } : undefined,
              errorCode: 'VALIDATION_FAILED',
              errorMessage: ai.validationDetails ?? '质量校验未通过',
              finishedAt: new Date(),
            },
          })
          await prisma.paragraph.update({
            where: { id: paragraphId },
            data: { status: 'error' },
          })
          return
        }

        // 扣费（免费重试不扣费）
        if (!isFreeRetry) {
          await deductCredits(userId, taskId, charCount, 'processed')
        }

        // 更新任务为成功
        await prisma.processTask.update({
          where: { id: taskId },
          data: {
            ...usageData,
            status: 'done',
            result: ai.result,
            validationPassed: true,
            finishedAt: new Date(),
          },
        })

        // 更新段落状态
        await prisma.paragraph.update({
          where: { id: paragraphId },
          data: { status: 'done' },
        })
      } catch (err) {
        const error = err as Error
        const isInsufficientCredits = error.message === 'INSUFFICIENT_CREDITS'

        await prisma.processTask.update({
          where: { id: taskId },
          data: {
            status: 'failed',
            errorCode: isInsufficientCredits ? 'INSUFFICIENT_CREDITS' : 'AI_ERROR',
            errorMessage: error.message,
            finishedAt: new Date(),
          },
        })

        await prisma.paragraph.update({
          where: { id: paragraphId },
          data: { status: 'error' },
        })

        // AI 调用失败不扣费，尝试退还（若已扣）
        if (!isInsufficientCredits && !isFreeRetry) {
          try {
            const task = await prisma.processTask.findUnique({ where: { id: taskId }, select: { credited: true } })
            if (task?.credited) await refundCredits(userId, taskId, charCount, 'refund_failed')
          } catch (_) {
            // 退还失败记录日志，不中断流程
            console.error('[Worker] 退款失败', taskId)
          }
        }
      }
    },
    { connection, concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '5') },
  )

  worker.on('failed', (job, err) => {
    console.error('[Worker] 任务失败', job?.id, err.message)
  })

  return worker
}
