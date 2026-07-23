import { redis } from './redis'
import { NextRequest } from 'next/server'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetSeconds: number
}

/**
 * 固定窗口限流：在 windowSeconds 秒内，同一 key 最多允许 limit 次。
 * 基于 Redis INCR + EXPIRE 实现。
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`
  const count = await redis.incr(redisKey)
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds)
  }
  const ttl = await redis.ttl(redisKey)
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetSeconds: ttl > 0 ? ttl : windowSeconds,
  }
}

/** 从请求头中提取客户端 IP（兼容反向代理）*/
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}
