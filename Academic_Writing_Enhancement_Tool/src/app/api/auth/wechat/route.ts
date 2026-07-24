import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { buildAuthorizeUrl, isWechatLoginEnabled } from '@/lib/wechat-oauth'

// GET /api/auth/wechat — 跳转到微信扫码授权页
export async function GET() {
  if (!isWechatLoginEnabled()) {
    return NextResponse.json(
      { ok: false, code: 'WECHAT_NOT_CONFIGURED', message: '微信登录暂未开放' },
      { status: 501 },
    )
  }

  // 生成一次性 state 防 CSRF，写入短时 httpOnly cookie
  const state = randomBytes(16).toString('hex')
  const res = NextResponse.redirect(buildAuthorizeUrl(state))
  res.cookies.set('wx_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 5 * 60, // 5 分钟内完成授权
    path: '/',
  })
  return res
}
