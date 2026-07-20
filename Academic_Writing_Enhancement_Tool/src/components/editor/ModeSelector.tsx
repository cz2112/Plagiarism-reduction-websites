'use client'

import type { ProcessMode } from '@/types'

interface ModeSelectorProps {
  value: ProcessMode
  onChange: (mode: ProcessMode) => void
  disabled?: boolean
}

const modes: { value: ProcessMode; label: string; description: string }[] = [
  {
    value: 'conservative',
    label: '保守改写',
    description: '调整重复表达和句式，改动幅度小，尽量保留原结构',
  },
  {
    value: 'polish',
    label: '学术润色',
    description: '纠正语病、改善口语化表达，提升逻辑衔接和专业性',
  },
]

export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">处理模式</label>
      <div className="flex gap-3">
        {modes.map((m) => (
          <button
            key={m.value}
            disabled={disabled}
            onClick={() => onChange(m.value)}
            className={[
              'flex-1 rounded-lg border p-3 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              value === m.value
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-700',
            ].join(' ')}
          >
            <div className="font-medium text-sm">{m.label}</div>
            <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{m.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
