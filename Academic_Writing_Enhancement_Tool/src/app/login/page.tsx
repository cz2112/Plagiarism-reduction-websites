'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

type Step = 'input' | 'code'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [channel] = useState<'email'>('email')
  const [target, setTarget] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    if (!target.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.trim(), channel }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.message ?? '发送失败'); return }
      setStep('code')
      // 60 秒倒计时
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
    setError('')
    setLoading(true)
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
                <p className="text-sm text-gray-500 mt-1">输入邮箱，我们将发送验证码</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="email">
                  邮箱地址
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full justify-center" loading={loading}>
                发送验证码
              </Button>
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
