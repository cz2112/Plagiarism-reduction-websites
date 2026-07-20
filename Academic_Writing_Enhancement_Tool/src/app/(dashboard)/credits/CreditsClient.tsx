'use client'

import { useState } from 'react'
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
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

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
      const json = await res.json()
      if (!json.ok) { alert(json.message ?? '创建订单失败'); return }
      setQrCode(json.data.codeUrl)
      setOrderId(json.data.orderId)
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
        <p>· 按提交正文中的汉字、字母和数字计费，不计标点和空格</p>
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
      {qrCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 text-center shadow-xl max-w-xs w-full">
            <h3 className="font-semibold text-gray-900 mb-4">微信扫码支付</h3>
            {/* 实际项目用 qrcode 库渲染二维码 */}
            <div className="rounded-lg bg-gray-100 h-40 flex items-center justify-center text-xs text-gray-400 mb-4">
              code_url: {qrCode.slice(0, 40)}…
            </div>
            <p className="text-sm text-gray-500 mb-4">支付成功后字数自动到账，可刷新页面查看</p>
            <Button variant="secondary" className="w-full justify-center" onClick={() => { setQrCode(null); setOrderId(null) }}>
              关闭
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
