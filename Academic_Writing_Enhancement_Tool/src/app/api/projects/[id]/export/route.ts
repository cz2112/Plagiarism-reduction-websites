import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'
import { exportToDocx } from '@/lib/word/exporter'

// GET /api/projects/[id]/export — 导出 Word 文档
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId, status: 'active' },
    include: {
      paragraphs: {
        orderBy: { index: 'asc' },
      },
    },
  })

  if (!project) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })
  }

  // 导出时使用 activeResult（已接受的修改），否则用原文
  const paragraphsForExport = project.paragraphs.map((p) => ({
    text: p.activeResult ?? p.original,
  }))

  const buffer = await exportToDocx(project.title, paragraphsForExport)

  const filename = encodeURIComponent(`${project.title}_优化版.docx`)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
    },
  })
}
