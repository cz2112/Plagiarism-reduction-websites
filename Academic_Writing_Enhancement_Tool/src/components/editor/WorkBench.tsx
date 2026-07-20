'use client'

import { useState, useCallback } from 'react'
import type { ParagraphView } from '@/types'
import { ParagraphCard } from './ParagraphCard'
import { Button } from '@/components/ui/Button'

interface WorkBenchProps {
  projectId: string
  projectTitle: string
  initialParagraphs: ParagraphView[]
  initialCredits: number
}

export function WorkBench({
  projectId,
  projectTitle,
  initialParagraphs,
  initialCredits,
}: WorkBenchProps) {
  const [paragraphs, setParagraphs] = useState<ParagraphView[]>(initialParagraphs)
  const [credits, setCredits] = useState(initialCredits)
  const [exporting, setExporting] = useState(false)

  // 某段落处理完成后，重新拉取该段落数据
  const handleProcessed = useCallback(async (paragraphId: string) => {
    const res = await fetch(`/api/projects/${projectId}`)
    const json = await res.json()
    if (!json.ok) return
    setParagraphs(json.data.paragraphs)

    // 同步余额
    const balRes = await fetch('/api/credits/balance')
    const balJson = await balRes.json()
    if (balJson.ok) setCredits(balJson.data.credits)
  }, [projectId])

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/export`)
      if (!res.ok) {
        alert('导出失败，请重试')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectTitle}_优化版.docx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const acceptedCount = paragraphs.filter((p) => p.status === 'accepted').length
  const totalCount = paragraphs.length

  return (
    <div className="flex flex-col gap-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          已处理 <strong className="text-gray-800">{acceptedCount}</strong> / {totalCount} 段 ·
          余额 <strong className="text-brand-600">{credits.toLocaleString()}</strong> 字符
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={exporting}
          onClick={handleExport}
          disabled={acceptedCount === 0}
        >
          导出 Word
        </Button>
      </div>

      {/* 段落列表 */}
      <div className="flex flex-col gap-3">
        {paragraphs.map((p) => (
          <ParagraphCard
            key={p.id}
            paragraph={p}
            userCredits={credits}
            onProcessed={handleProcessed}
          />
        ))}
      </div>

      {totalCount === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          暂无段落，请检查原文是否为空
        </div>
      )}
    </div>
  )
}
