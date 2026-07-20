/**
 * 原文 vs 修改结果对照视图
 * 通过简单的字符级差异高亮显示变化
 */
'use client'

interface DiffViewProps {
  original: string
  result: string
}

export function DiffView({ original, result }: DiffViewProps) {
  return (
    <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 overflow-hidden text-sm">
      {/* 原文 */}
      <div className="p-4 bg-red-50/30">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-xs font-medium text-gray-500">原文</span>
        </div>
        <p className="leading-relaxed text-gray-700 whitespace-pre-wrap">{original}</p>
      </div>

      {/* 修改结果 */}
      <div className="p-4 bg-green-50/30 border-l border-gray-200">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs font-medium text-gray-500">优化结果</span>
        </div>
        <p className="leading-relaxed text-gray-800 whitespace-pre-wrap">{result}</p>
      </div>
    </div>
  )
}
