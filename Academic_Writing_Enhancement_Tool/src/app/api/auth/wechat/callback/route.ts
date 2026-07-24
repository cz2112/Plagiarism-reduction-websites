import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { grantFreeQuota } from '@/lib/billing'
import { exchangeCodeForUser } from '@/lib/wechat-oauth'

function appUrl(path: string): URL {
  return new URL(path, process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
}

// GET /api/auth/wechat/callback — 微信授权回调
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const savedState = req.cookies.get('wx_oauth_state')?.value

  // 用户取消或参数缺失
  if (!code || !state) {
    return NextResponse.redirect(appUrl('/login?error=wechat_cancelled'))
  }
  // CSRF 校验
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(appUrl('/login?error=wechat_state'))
  }

  try {
    const info = await exchangeCodeForUser(code)

    // 优先用 unionid 识别（跨应用唯一），否则退回 openid
    const user = await prisma.$transaction(async (tx) => {
      let u = info.unionid
        ? await tx.user.findUnique({ where: { wechatUnionId: info.unionid } })
        : null
      if (!u) {
        u = await tx.user.findUnique({ where: { wechatOpenId: info.openid } })
      }
      if (u) {
        // 已存在：补齐可能缺失的资料
        return tx.user.update({
          where: { id: u.id },
          data: {
            wechatUnionId: info.unionid ?? u.wechatUnionId,
            wechatOpenId: u.wechatOpenId ?? info.openid,
            nickname: info.nickname ?? u.nickname,
            avatar: info.avatar ?? u.avatar,
          },
        })
      }
      // 新用户
      return tx.user.create({
        data: {
          wechatUnionId: info.unionid,
          wechatOpenId: info.openid,
          nickname: info.nickname,
          avatar: info.avatar,
        },
      })
    })

    // 新用户发放免费额度（grantFreeQuota 内部对 freeUsed 幂等）
    if (!user.freeUsed) {
      await grantFreeQuota(user.id)
    }

    // 写入 Session
    const session = await getSession()
    session.userId = user.id
    await session.save()

    const res = NextResponse.redirect(appUrl('/projects'))
    res.cookies.delete('wx_oauth_state')
    return res
  } catch (err) {
    console.error('[wechat callback]', err)
    return NextResponse.redirect(appUrl('/login?error=wechat_failed'))
  }
}
