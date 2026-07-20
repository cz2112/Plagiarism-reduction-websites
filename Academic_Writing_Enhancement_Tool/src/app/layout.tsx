import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '文清 AI — 学术表达优化工具',
  description: '面向中文本科和硕士论文的段落级学术表达优化工具',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
