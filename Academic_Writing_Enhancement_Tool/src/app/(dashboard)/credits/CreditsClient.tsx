'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/Button'

interface Package {
  id: string
  name: string
  chars: number
  priceFen: number
  priceYuan: string
  highlight?: boolean
}

const PACKAGES: Package[] = [
  { id: 'free',     name: '免费体验', chars: 1000,   priceFen: 0,    priceYuan: '免费',  },
  { id: 'small',    name: '小份套餐', chars: 5000,   priceFen: 990,  priceYuan: '¥9.9'  },
  { id: 'standard', name: '标准套餐', chars: 20000,  priceFen: 2990, priceYuan: '¥29.9', highlight: true },
  { id: 'large',    name: '大份套餐', chars: 50000,  priceFen: 5990, priceYuan: '¥59.9' },
  { id: 'pro',      name: '专业套餐', chars: 100000, priceFen: 9990, priceYuan: '¥99.9' },
]

interface CreditsClientProps {
  balance: number
  dbPackages: { id: string; name: string; chars: number; priceFen: number }[]
}

export function CreditsClient({ balance, dbPackages }: CreditsClientProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  const [mockMode, setMockMode] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 把 code_url 渲染成可扫描的二维码图片
  useEffect(() => {
    if (!qrCode) { setQrDataUrl(null); return }
    QRCode.toDataURL(qrCode, { width: 200, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [qrCode])

  // 轮询订单支付状态：每 3 秒一次，最多 5 分钟
  useEffect(() => {
    if (!orderId) return
    let elapsed = 0
    pollRef.current = setInterval(async () => {
      elapsed += 3
      if (elapsed > 300) { // 5 分钟超时
        if (pollRef.current) clearInterval(pollRef.current)
        return
      }
      try {
        const res = await fetch(`/api/payment/status?orderId=${orderId}`)
        const json = await res.json()
        if (json.ok && json.data.status === 'paid') {
          if (pollRef.current) clearInterval(pollRef.current)
          setPaid(true)
          // 刷新余额
          setTimeout(() => router.refresh(), 1500)
        }
      } catch {
        // 忽略单次轮询失败
      }
    }, 3000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [orderId, router])

  function closeModal() {
    if (pollRef.current) clearInterval(pollRef.current)
    setQrCode(null)
    setQrDataUrl(null)
    setOrderId(null)
    setPaid(false)
    setMockMode(false)
  }

  // 优先用数据库套餐，数据库为空时用静态配置
  const packages = dbPackages.length > 0
    ? dbPackages.map((p) => ({
        ...p,
        priceYuan: p.priceFen === 0 ? '免费' : `¥${(p.priceFen / 100).toFixed(1)}`,
        highlight: p.chars === 20000,
      }))
    : PACKAGES

  async function handleBuy() {
    if (!selected) return
    const pkg = packages.find((p) => p.id === selected)
    if (!pkg || pkg.priceFen === 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selected }),
      })
      const json = await res.json().catch(() => ({ ok: false, message: `请求失败（HTTP ${res.status}）` }))
      if (!json.ok) { alert(json.message ?? '创建订单失败'); return }
      setQrCode(json.data.codeUrl ?? null)
      setOrderId(json.data.orderId)
      setMockMode(json.data.mock === true)
    } finally {
      setLoading(false)
    }
  }

  async function confirmMockPayment() {
    if (!orderId) return
    setLoading(true)
    try {
      const res = await fetch('/api/payment/mock-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const json = await res.json().catch(() => ({ ok: false, message: `请求失败（HTTP ${res.status}）` }))
      if (!json.ok) { alert(json.message ?? '模拟支付失败'); return }
      setPaid(true)
      setTimeout(() => router.refresh(), 800)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">购买字数</h1>
        <p className="text-sm text-gray-500 mt-1">
          当前余额：<strong className="text-brand-600 text-base">{balance.toLocaleString()}</strong> 字符
        </p>
      </div>

      {/* 套餐卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setSelected(pkg.id)}
            className={[
              'relative rounded-xl border p-4 text-left transition-all',
              selected === pkg.id
                ? 'border-brand-500 bg-brand-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300',
              pkg.priceFen === 0 ? 'opacity-60 cursor-not-allowed' : '',
            ].join(' ')}
            disabled={pkg.priceFen === 0}
            title={pkg.priceFen === 0 ? '注册即赠，无需购买' : undefined}
          >
            {(pkg as any).highlight && (
              <span className="absolute -top-2.5 left-4 rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">
                推荐
              </span>
            )}
            <div className="font-semibold text-gray-900">{pkg.name}</div>
            <div className="text-2xl font-bold text-brand-600 mt-1">{pkg.priceYuan}</div>
            <div className="text-sm text-gray-500 mt-1">{pkg.chars.toLocaleString()} 字符 · 有效期 12 个月</div>
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-400 space-y-1">
        <p>· 按提交正文中的汉字、字母和数字统计字数，不计标点和空格</p>
        <p>· 实际扣费 = 字数 × 改写强度倍率：普通降重 ×1.0、深度降重 ×1.8、至尊降重 ×3.0</p>
        <p>· 通过质量校验即扣费，与是否接受结果无关；每段首次重试免费</p>
        <p>· 生成失败不扣费；购买的字数有效期 12 个月</p>
      </div>

      <Button
        className="w-full justify-center"
        disabled={!selected || packages.find((p) => p.id === selected)?.priceFen === 0}
        loading={loading}
        onClick={handleBuy}
      >
        微信扫码支付
      </Button>

      {/* 二维码弹窗 */}
      {orderId && (mockMode || qrCode) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 text-center shadow-xl max-w-xs w-full">
            {paid ? (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">✓</div>
                <h3 className="font-semibold text-gray-900 mb-2">支付成功</h3>
                <p className="text-sm text-gray-500 mb-4">字数已到账</p>
                <Button className="w-full justify-center" onClick={closeModal}>完成</Button>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-gray-900 mb-4">
                  {mockMode ? '模拟支付' : '微信扫码支付'}
                </h3>
                {mockMode ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4 text-sm text-amber-800">
                    本地开发模式，不会产生真实扣款。
                  </div>
                ) : (
                  <div className="rounded-lg bg-white h-52 flex items-center justify-center mb-4">
                    {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrDataUrl} alt="微信支付二维码" width={200} height={200} />
                    ) : (
                      <span className="text-xs text-gray-400">二维码生成中…</span>
                    )}
                  </div>
                )}
                {mockMode ? (
                  <Button loading={loading} className="w-full justify-center mb-2" onClick={confirmMockPayment}>
                    确认模拟支付
                  </Button>
                ) : (
                  <p className="text-sm text-gray-500 mb-4">请使用微信扫码支付，支付成功后自动到账</p>
                )}
                <Button variant="secondary" className="w-full justify-center" onClick={closeModal}>
                  取消
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
