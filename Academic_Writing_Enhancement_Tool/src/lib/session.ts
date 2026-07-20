import { getIronSession, IronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export interface SessionData {
  userId: string
}

export const sessionOptions: SessionOptions = {
  cookieName: 'wenqing_session',
  password: process.env.SESSION_SECRET as string,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 天
  },
}

/** 在 Server Component / Route Handler 中获取 Session */
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}

/** 获取当前登录用户 ID，未登录返回 null */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession()
  return session.userId ?? null
}

/** 从 Request/Response 对获取 Session（用于 middleware 或自定义响应） */
export async function getSessionFromReq(
  req: NextRequest,
  res: NextResponse,
): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(req, res, sessionOptions)
}
