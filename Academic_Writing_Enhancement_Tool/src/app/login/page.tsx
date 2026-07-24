'use client'

import { useState, useEffect, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'

type Step = 'input' | 'code'
type Method = 'email' | 'phone'

const WECHAT_ENABLED = process.env.NEXT_PUBLIC_WECHAT_LOGIN_ENABLED === 'true'

const ERROR_MESSAGES: Record<string, string> = {
  wechat_cancelled: '已取消微信登录',
  wechat_state: '微信登录校验失败，请重试',
  wechat_failed: '微信登录失败，请重试',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [method, setMethod] = useState<Method>('email')
  const [step, setStep] = useState<Step>('input')
  const [target, setTarget] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    const e = searchParams.get('error')
    if (e && ERROR_MESSAGES[e]) setError(ERROR_MESSAGES[e])
  }, [searchParams])

  const channel = method === 'email' ? 'email' : 'sms'

  function switchMethod(m: Method) {
    if (m === method) return
    setMethod(m)
    setStep('input')
    setTarget('')
    setCode('')
    setError('')
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    const t = target.trim()
    if (!t) return
    if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      setError('邮箱格式不正确'); return
    }
    if (method === 'phone' && !/^1[3-9]\d{9}$/.test(t)) {
      setError('手机号格式不正确'); return
    }
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: t, channel }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.message ?? '发送失败'); return }
      setStep('code')
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((c) => { if (c <= 1) { clearInterval(timer); return 0 } return c - 1 })
      }, 1000)
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    if (code.length !== 6) return
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.trim(), channel, code }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.message ?? '验证失败'); return }
      router.push('/projects')
    } finally {
      setLoading(false)
    }
  }

  const isEmail = method === 'email'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white text-lg font-bold">
            文
          </div>
          <div>
            <div className="font-bold text-gray-900 text-lg">文清 AI</div>
            <div className="text-xs text-gray-500">学术表达优化工具</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {step === 'input' ? (
            <form onSubmit={sendCode} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">登录 / 注册</h1>
                <p className="text-sm text-gray-500 mt-1">未注册的账号将自动创建</p>
              </div>

              {/* 邮箱 / 手机号 切换 */}
              <div className="flex rounded-lg bg-gray-100 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => switchMethod('email')}
                  className={`flex-1 rounded-md py-1.5 font-medium transition ${isEmail ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  邮箱
                </button>
                <button
                  type="button"
                  onClick={() => switchMethod('phone')}
                  className={`flex-1 rounded-md py-1.5 font-medium transition ${!isEmail ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  手机号
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="target">
                  {isEmail ? '邮箱地址' : '手机号'}
                </label>
                <input
                  id="target"
                  type={isEmail ? 'email' : 'tel'}
                  inputMode={isEmail ? 'email' : 'numeric'}
                  required
                  value={target}
                  onChange={(e) => setTarget(isEmail ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder={isEmail ? 'your@email.com' : '请输入手机号'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full justify-center" loading={loading}>
                发送验证码
              </Button>

              {WECHAT_ENABLED && (
                <>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs text-gray-400">或</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                  <a
                    href="/api/auth/wechat"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#07C160]" fill="currentColor" aria-hidden="true">
                      <path d="M8.5 4C4.36 4 1 6.9 1 10.48c0 2.02 1.08 3.82 2.77 5.02L3 18l2.6-1.3c.9.25 1.87.38 2.9.38.26 0 .52-.01.77-.03a5.6 5.6 0 0 1-.24-1.6c0-3.28 3.1-5.94 6.92-5.94.25 0 .5.01.74.04C15.9 6.15 12.6 4 8.5 4Zm-2.6 3.3a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Zm5.2 0a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Z" />
                      <path d="M23 15.83c0-2.9-2.9-5.26-6.48-5.26s-6.48 2.36-6.48 5.26 2.9 5.26 6.48 5.26c.74 0 1.46-.1 2.12-.28L21 22l-.53-1.75A5.03 5.03 0 0 0 23 15.83Zm-8.6-1.1a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Zm4.24 0a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Z" />
                    </svg>
                    微信登录
                  </a>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">输入验证码</h1>
                <p className="text-sm text-gray-500 mt-1">
                  验证码已发送至 <strong>{target}</strong>，10 分钟内有效
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="code">
                  6 位验证码
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full justify-center" loading={loading}>
                登录
              </Button>
              <button
                type="button"
                disabled={countdown > 0}
                onClick={() => setStep('input')}
                className="w-full text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                {countdown > 0 ? `${countdown}s 后可重新发送` : '重新发送'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          登录即代表同意{' '}
          <a href="#" className="underline hover:text-gray-600">用户协议</a>
          {' '}和{' '}
          <a href="#" className="underline hover:text-gray-600">隐私政策</a>。
          本工具仅辅助语言表达优化，用户应自行核对学术规范。
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
