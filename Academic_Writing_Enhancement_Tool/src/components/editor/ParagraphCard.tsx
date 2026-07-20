'use client'

import { useState, useEffect } from 'react'
import type { ParagraphView, ProcessMode } from '@/types'
import { Badge, statusLabel } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DiffView } from './DiffView'
import { ModeSelector } from './ModeSelector'
import { TermLockInput } from './TermLockInput'

interface ParagraphCardProps {
  paragraph: ParagraphView
  userCredits: number
  onProcessed: (paragraphId: string) => void
}

export function ParagraphCard({ paragraph, userCredits, onProcessed }: ParagraphCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<ProcessMode>('conservative')
  const [lockedTerms, setLockedTerms] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [polling, setPolling] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [localParagraph, setLocalParagraph] = useState(paragraph)
  const [editMode, setEditMode] = useState(false)
  const [editText, setEditText] = useState('')

  // 同步外部段落数据
  useEffect(() => {
    setLocalParagraph(paragraph)
  }, [paragraph])

  // 轮询任务状态
  useEffect(() => {
    if (!taskId || !polling) return
    const timer = setInterval(async () => {
      const res = await fetch(`/api/tasks/${taskId}`)
      const json = await res.json()
      if (!json.ok) return
      const task = json.data
      if (task.status === 'done' || task.status === 'failed') {
        setPolling(false)
        setTaskId(null)
        onProcessed(paragraph.id)
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [taskId, polling, paragraph.id, onProcessed])

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paragraphId: paragraph.id, mode, lockedTerms }),
      })
      const json = await res.json()
      if (!json.ok) {
        alert(json.message ?? '提交失败')
        return
      }
      setTaskId(json.data.taskId)
      setPolling(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAccept() {
    await fetch(`/api/paragraphs/${paragraph.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    })
    onProcessed(paragraph.id)
  }

  async function handleRevert() {
    await fetch(`/api/paragraphs/${paragraph.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revert' }),
    })
    onProcessed(paragraph.id)
  }

  async function handleEditSave() {
    await fetch(`/api/paragraphs/${paragraph.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', editedText: editText }),
    })
    setEditMode(false)
    onProcessed(paragraph.id)
  }

  const { label, variant } = statusLabel(localParagraph.status)
  const isProcessing = localParagraph.status === 'processing' || polling
  const hasDoneResult = localParagraph.latestTask?.status === 'done' && localParagraph.latestTask.result
  const hasError = localParagraph.latestTask?.status === 'failed'
  const insufficientCredits = userCredits < localParagraph.charCount

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* 段落头部 */}
      <button
        className="w-full flex items-start gap-3 p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xs text-gray-400 font-mono mt-0.5 w-5 shrink-0">
          {localParagraph.index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
            {localParagraph.original}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge label={label} variant={variant} />
            <span className="text-xs text-gray-400">{localParagraph.charCount} 字符</span>
            {insufficientCredits && localParagraph.status === 'pending' && (
              <span className="text-xs text-red-500">余额不足</span>
            )}
          </div>
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* 处理结果展示 */}
          {hasDoneResult && !editMode && (
            <DiffView original={localParagraph.original} result={localParagraph.latestTask!.result!} />
          )}

          {/* 已接受后的结果展示 */}
          {localParagraph.status === 'accepted' && localParagraph.activeResult && !editMode && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs font-medium text-gray-500">已接受的版本</span>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {localParagraph.activeResult}
              </p>
            </div>
          )}

          {/* 手动编辑 */}
          {editMode && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">手动编辑结果</label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEditSave}>保存</Button>
                <Button size="sm" variant="secondary" onClick={() => setEditMode(false)}>取消</Button>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {hasError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              生成失败：{localParagraph.latestTask?.errorMessage ?? '未知错误'}，本次不扣费。
            </div>
          )}

          {/* 处理中提示 */}
          {isProcessing && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              AI 正在处理中，通常在 30 秒内完成…
            </div>
          )}

          {/* 操作区 */}
          {!isProcessing && (
            <>
              {/* 未处理或失败时显示提交区 */}
              {(localParagraph.status === 'pending' || localParagraph.status === 'error' || localParagraph.status === 'done') && (
                <div className="space-y-3">
                  <ModeSelector value={mode} onChange={setMode} />
                  <TermLockInput terms={lockedTerms} onChange={setLockedTerms} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      本次消耗约 <strong>{localParagraph.charCount}</strong> 字符
                      {localParagraph.latestTask?.isFreeRetry === false && ' · 首次重试免费'}
                    </span>
                    <Button
                      onClick={handleSubmit}
                      loading={submitting}
                      disabled={insufficientCredits}
                    >
                      {localParagraph.status === 'error' ? '重新生成' : '开始优化'}
                    </Button>
                  </div>
                </div>
              )}

              {/* 已生成时显示接受/重试/编辑 */}
              {localParagraph.status === 'done' && hasDoneResult && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAccept}>接受结果</Button>
                  <Button size="sm" variant="secondary" onClick={() => {
                    setEditText(localParagraph.latestTask?.result ?? '')
                    setEditMode(true)
                  }}>手动编辑</Button>
                </div>
              )}

              {/* 已接受时显示撤销 */}
              {localParagraph.status === 'accepted' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={handleRevert}>撤销</Button>
                  <Button size="sm" variant="secondary" onClick={() => {
                    setEditText(localParagraph.activeResult ?? '')
                    setEditMode(true)
                  }}>编辑</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
