import IORedis from 'ioredis'

// 通用 Redis 客户端（用于频率限制、验证码尝试计数等）
// 与 BullMQ 的连接分开：BullMQ 需要 maxRetriesPerRequest: null，这里用默认值
const globalForRedis = globalThis as unknown as { redis?: IORedis }

export const redis =
  globalForRedis.redis ??
  new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    // 延迟连接：避免在 build / 导入阶段就尝试连接
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  })

// 挂上 error 监听，避免 "Unhandled error event" 导致进程崩溃
redis.on('error', (err) => {
  console.error('[redis] connection error:', err.message)
})

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis
