'use client'

import type { ProcessMode } from '@/types'
import { MODE_LIST, billedChars } from '@/lib/modes'

interface ModeSelectorProps {
  value: ProcessMode
  onChange: (mode: ProcessMode) => void
  /** 原文计费字符数，用于展示每档预计消耗 */
  rawChars: number
  disabled?: boolean
}

export function ModeSelector({ value, onChange, rawChars, disabled }: ModeSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">改写强度</label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {MODE_LIST.map((m) => {
          const active = value === m.value
          const cost = billedChars(rawChars, m.value)
          return (
            <button
              key={m.value}
              disabled={disabled}
              onClick={() => onChange(m.value)}
              className={[
                'flex flex-col rounded-lg border p-3 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                active
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{m.label}</span>
                <span
                  className={[
                    'rounded px-1.5 py-0.5 text-[11px] font-medium',
                    active ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500',
                  ].join(' ')}
                >
                  ×{m.multiplier}
                </span>
              </div>
              <span className="mt-1 text-xs text-gray-500 leading-relaxed">{m.description}</span>
              <span className="mt-2 text-xs text-gray-600">
                预计消耗 <strong>{cost.toLocaleString()}</strong> 字符
              </span>
              <span className="text-[11px] text-gray-400">约 {m.estimatedSeconds} 秒内完成</span>
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed">
        三档均保留原意、数字、引用和锁定术语，生成失败不扣费，每段首次重试免费。改写强度越高，扣费字符越多。
      </p>
    </div>
  )
}
