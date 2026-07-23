import { createHmac, timingSafeEqual } from 'crypto'

function getOtpSecret(): string {
  const secret = process.env.OTP_HASH_SECRET ?? process.env.SESSION_SECRET
  if (!secret) throw new Error('OTP_HASH_SECRET_OR_SESSION_SECRET_REQUIRED')
  return secret
}

export function hashOtp(target: string, code: string): string {
  return createHmac('sha256', getOtpSecret()).update(`${target}:${code}`).digest('hex')
}

export function verifyOtpHash(target: string, code: string, expected: string): boolean {
  const actual = Buffer.from(hashOtp(target, code), 'utf8')
  const stored = Buffer.from(expected, 'utf8')
  return actual.length === stored.length && timingSafeEqual(actual, stored)
}
