import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

// POST /api/auth/logout
export async function POST() {
  const session = await getSession()
  session.destroy()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))
}
