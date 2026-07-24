'use client'

import { useState, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import type { ProjectView } from '@/types'

interface ProjectsClientProps {
  projects: ProjectView[]
}

export function ProjectsClient({ projects: initial }: ProjectsClientProps) {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectView[]>(initial)
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'paste' | 'docx'>('paste')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      let res: Response
      if (tab === 'paste') {
        res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title || '未命名论文', sourceType: 'paste', text }),
        })
      } else {
        if (!file) { setError('请选择文件'); return }
        const fd = new FormData()
        fd.append('title', title || '未命名论文')
        fd.append('file', file)
        res = await fetch('/api/projects', { method: 'POST', body: fd })
      }
      const json = await res.json()
      if (!json.ok) { setError(json.message ?? '创建失败'); return }
      router.push(`/projects/${json.data.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确认删除该项目？已处理内容不会退还字数。')) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setProjects((p) => p.filter((x) => x.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">我的论文</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>新建项目</Button>
      </div>

      {/* 新建弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-6">
            <h2 className="text-lg font-semibold mb-4">新建论文项目</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">项目名称</label>
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：毕业论文_第三章"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Tab */}
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                {(['paste', 'docx'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setTab(t)}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {t === 'paste' ? '粘贴文本' : '上传 Word'}
                  </button>
                ))}
              </div>

              {tab === 'paste' ? (
                <textarea
                  value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="将论文段落粘贴到此处…"
                  rows={8}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              ) : (
                <div>
                  <input ref={fileRef} type="file" accept=".docx" className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-gray-300 p-6 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
                    {file ? `已选择：${file.name}` : '点击选择 .docx 文件（最大 500MB）'}
                  </button>
                </div>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3 justify-end">
                <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>取消</Button>
                <Button type="submit" loading={creating}>创建并导入</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 项目列表 */}
      {projects.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">还没有项目，点击「新建项目」开始优化</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex-1 min-w-0">
                <Link href={`/projects/${p.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                  {p.title}
                </Link>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{p.paragraphCount} 段</span>
                  <span>{p.totalChars.toLocaleString()} 字符</span>
                  <span>{new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link href={`/projects/${p.id}`}>
                  <Button size="sm" variant="secondary">打开</Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}
                  className="text-red-400 hover:text-red-600">删除</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
