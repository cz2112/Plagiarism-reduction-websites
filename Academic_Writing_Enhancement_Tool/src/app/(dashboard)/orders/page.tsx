import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'

export default async function OrdersPage() {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/login')

  const [usageLogs, orders] = await Promise.all([
    prisma.usageLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.order.findMany({
      where: { userId },
      include: { package: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900">使用记录</h1>

      {/* 充值订单 */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">充值订单</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400">暂无充值记录</p>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">套餐</th>
                  <th className="px-4 py-3 text-right">字符数</th>
                  <th className="px-4 py-3 text-right">金额</th>
                  <th className="px-4 py-3 text-center">状态</th>
                  <th className="px-4 py-3 text-right">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 text-gray-700">{o.package.name}</td>
                    <td className="px-4 py-3 text-right text-gray-700">+{o.chars.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {o.priceFen === 0 ? '免费' : `¥${(o.priceFen / 100).toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        o.status === 'paid' ? 'bg-green-50 text-green-700' :
                        o.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {{ paid: '已支付', pending: '待支付', refunded: '已退款', cancelled: '已取消' }[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {new Date(o.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 字符消费记录 */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">字符消费记录</h2>
        {usageLogs.length === 0 ? (
          <p className="text-sm text-gray-400">暂无消费记录</p>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">说明</th>
                  <th className="px-4 py-3 text-right">变动</th>
                  <th className="px-4 py-3 text-right">余额</th>
                  <th className="px-4 py-3 text-right">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usageLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 text-gray-700">
                      {{ processed: 'AI 处理', refund_failed: '生成失败退还', refund_free_retry: '免费重试退还' }[l.reason] ?? l.reason}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${l.charCount < 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {l.charCount < 0 ? `+${Math.abs(l.charCount)}` : `-${l.charCount}`}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{l.balanceAfter.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {new Date(l.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
