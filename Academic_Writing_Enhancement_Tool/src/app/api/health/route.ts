import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/health — 健康检查（供负载均衡器 / 监控使用）
export async function GET() {
  try {
    // 探测数据库连通性
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: 'up', ts: Date.now() })
  } catch {
    return NextResponse.json({ ok: false, db: 'down', ts: Date.now() }, { status: 503 })
  }
}
