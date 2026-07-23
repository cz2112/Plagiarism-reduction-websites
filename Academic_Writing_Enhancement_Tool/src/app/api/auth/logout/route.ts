import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

// POST /api/auth/logout
export async function POST(req: NextRequest) {
  const session = await getSession()
  session.destroy()
  // 用请求自身的 origin 作为跳转基址，避免 NEXT_PUBLIC_APP_URL 未配置时 URL 构造抛错
  const base = process.env.NEXT_PUBLIC_APP_URL || req.url
  return NextResponse.redirect(new URL('/login', base))
}
