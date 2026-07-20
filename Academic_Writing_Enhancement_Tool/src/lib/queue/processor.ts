/**
 * 任务队列处理器
 * 使用 BullMQ 异步处理 AI 生成任务
 */

import { Queue, Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '../db'
import { processWithAI } from '../ai/adapter'
import { validateOutput } from '../ai/validator'
import { deductCredits, refundCredits } from '../billing'
import type { ProcessMode } from '@/types'

// ── Redis 连接 ─────────────────────────────────────────

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // BullMQ 要求
})

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

      let resultText: string | null = null
      let validationPassed = false

      try {
        // 调用 AI
        const aiResult = await processWithAI({ original, mode, lockedTerms })
        resultText = aiResult.result

        // 校验输出
        const validation = validateOutput(original, resultText, lockedTerms)
        validationPassed = validation.passed

        if (!validationPassed) {
          // 第一次失败，自动重试一次
          const aiRetry = await processWithAI({ original, mode, lockedTerms })
          resultText = aiRetry.result
          const retryValidation = validateOutput(original, resultText, lockedTerms)
          validationPassed = retryValidation.passed

          if (!validationPassed) {
            // 两次都失败，任务失败，不扣费
            await prisma.processTask.update({
              where: { id: taskId },
              data: {
                status: 'failed',
                result: resultText,
                validationPassed: false,
                validationDetails: JSON.parse(JSON.stringify(retryValidation)),
                errorCode: 'VALIDATION_FAILED',
                errorMessage: retryValidation.details ?? '质量校验未通过',
                finishedAt: new Date(),
              },
            })
            await prisma.paragraph.update({
              where: { id: paragraphId },
              data: { status: 'error' },
            })
            return
          }
        }

        // 扣费（免费重试不扣费）
        if (!isFreeRetry) {
          await deductCredits(userId, taskId, charCount, 'processed')
        }

        // 更新任务为成功
        await prisma.processTask.update({
          where: { id: taskId },
          data: {
            status: 'done',
            result: resultText,
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
            await refundCredits(userId, taskId, charCount, 'refund_failed')
          } catch (_) {
            // 退还失败记录日志，不中断流程
            console.error('[Worker] 退款失败', taskId)
          }
        }
      }
    },
    { connection, concurrency: 5 },
  )

  worker.on('failed', (job, err) => {
    console.error('[Worker] 任务失败', job?.id, err.message)
  })

  return worker
}
