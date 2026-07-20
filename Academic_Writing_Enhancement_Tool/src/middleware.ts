import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromReq } from './lib/session'

// 需要登录才能访问的路径前缀
const PROTECTED_PATHS = ['/projects', '/credits', '/orders', '/api/projects', '/api/process', '/api/tasks', '/api/paragraphs', '/api/credits']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const res = NextResponse.next()
  const session = await getSessionFromReq(req, res)

  if (!session.userId) {
    // API 请求返回 401，页面请求跳转登录
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/projects/:path*',
    '/credits/:path*',
    '/orders/:path*',
    '/api/projects/:path*',
    '/api/process',
    '/api/tasks/:path*',
    '/api/paragraphs/:path*',
    '/api/credits/:path*',
  ],
}
