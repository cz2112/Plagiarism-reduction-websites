/**
 * 微信开放平台「网站应用」扫码登录（OAuth2 snsapi_login）
 * 注意：这是「网站应用」，与微信支付/公众号是不同的应用，需在
 * 微信开放平台 open.weixin.qq.com 单独创建并通过认证。
 *
 * 需要的环境变量：
 *   WECHAT_WEBSITE_APP_ID
 *   WECHAT_WEBSITE_APP_SECRET
 *   WECHAT_WEBSITE_REDIRECT_URI   回调地址（须与开放平台配置的授权域名一致）
 */

export interface WechatUserInfo {
  openid: string
  unionid?: string
  nickname?: string
  avatar?: string
}

/** 是否已配置微信网站登录（前端据此决定是否显示按钮） */
export function isWechatLoginEnabled(): boolean {
  return Boolean(
    process.env.WECHAT_WEBSITE_APP_ID &&
      process.env.WECHAT_WEBSITE_APP_SECRET &&
      process.env.WECHAT_WEBSITE_REDIRECT_URI,
  )
}

/** 构造扫码授权页 URL */
export function buildAuthorizeUrl(state: string): string {
  const appId = requireEnv('WECHAT_WEBSITE_APP_ID')
  const redirectUri = requireEnv('WECHAT_WEBSITE_REDIRECT_URI')
  const params = new URLSearchParams({
    appid: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'snsapi_login',
    state,
  })
  return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`
}

/** 用授权 code 换取 access_token + openid（并尽量取到 unionid） */
export async function exchangeCodeForUser(code: string): Promise<WechatUserInfo> {
  const appId = requireEnv('WECHAT_WEBSITE_APP_ID')
  const secret = requireEnv('WECHAT_WEBSITE_APP_SECRET')

  const tokenUrl =
    `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}` +
    `&secret=${secret}&code=${encodeURIComponent(code)}&grant_type=authorization_code`

  const tokenResp = await fetch(tokenUrl)
  const token = (await tokenResp.json()) as {
    access_token?: string
    openid?: string
    unionid?: string
    errcode?: number
    errmsg?: string
  }

  if (token.errcode || !token.access_token || !token.openid) {
    throw new Error(`WeChat token error: ${token.errcode ?? ''} ${token.errmsg ?? 'no token'}`)
  }

  const info: WechatUserInfo = { openid: token.openid, unionid: token.unionid }

  // 拉取用户资料（昵称/头像/unionid）
  try {
    const infoUrl =
      `https://api.weixin.qq.com/sns/userinfo?access_token=${token.access_token}` +
      `&openid=${token.openid}`
    const infoResp = await fetch(infoUrl)
    const profile = (await infoResp.json()) as {
      nickname?: string
      headimgurl?: string
      unionid?: string
      errcode?: number
    }
    if (!profile.errcode) {
      info.nickname = profile.nickname
      info.avatar = profile.headimgurl
      if (profile.unionid) info.unionid = profile.unionid
    }
  } catch {
    // 拉资料失败不阻断登录，openid 已足够识别用户
  }

  return info
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name}_REQUIRED`)
  return v
}
