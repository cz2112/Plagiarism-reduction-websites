'use client'

import { useState, KeyboardEvent } from 'react'

interface TermLockInputProps {
  terms: string[]
  onChange: (terms: string[]) => void
  disabled?: boolean
}

export function TermLockInput({ terms, onChange, disabled }: TermLockInputProps) {
  const [input, setInput] = useState('')

  function addTerm() {
    const trimmed = input.trim()
    if (trimmed && !terms.includes(trimmed)) {
      onChange([...terms, trimmed])
    }
    setInput('')
  }

  function removeTerm(term: string) {
    onChange(terms.filter((t) => t !== term))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTerm()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">
        锁定术语
        <span className="ml-1.5 text-xs text-gray-400 font-normal">（输入后按 Enter 添加，AI 不会修改这些词）</span>
      </label>

      {/* 已添加的术语 */}
      {terms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {terms.map((term) => (
            <span
              key={term}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
            >
              {term}
              <button
                disabled={disabled}
                onClick={() => removeTerm(term)}
                className="hover:text-red-500 disabled:opacity-50"
                aria-label={`移除 ${term}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          disabled={disabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTerm}
          placeholder="输入术语后按 Enter"
          className={[
            'flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-brand-500',
            'disabled:opacity-50',
          ].join(' ')}
        />
      </div>
    </div>
  )
}
