/**
 * 后台 Worker 进程入口
 * 独立于 Next.js 运行，处理 AI 任务队列
 * 启动：npm run worker
 */

import { createWorker } from '../lib/queue/processor'
import { validateModelConfig } from '../lib/ai/model-router'

console.log('[Worker] 启动中...')

// 生产环境：模型配置不完整时直接退出，避免静默调用错误/昂贵模型
validateModelConfig()

const worker = createWorker()

worker.on('ready', () => {
  console.log('[Worker] 已就绪，等待任务...')
})

worker.on('active', (job) => {
  console.log(`[Worker] 开始处理任务 ${job.id}`)
})

worker.on('completed', (job) => {
  console.log(`[Worker] 任务完成 ${job.id}`)
})

worker.on('failed', (job, err) => {
  console.error(`[Worker] 任务失败 ${job?.id}:`, err.message)
})

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[Worker] 收到 SIGTERM，正在关闭...')
  await worker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[Worker] 收到 SIGINT，正在关闭...')
  await worker.close()
  process.exit(0)
})
