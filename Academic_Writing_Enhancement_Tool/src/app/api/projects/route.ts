import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'
import { splitIntoParagraphs, parseDocx } from '@/lib/word/parser'

const createProjectSchema = z.object({
  title: z.string().min(1).max(100),
  sourceType: z.enum(['paste', 'docx']),
  text: z.string().optional(),
})

// GET /api/projects — 获取项目列表
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const projects = await prisma.project.findMany({
    where: { userId, status: 'active' },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { paragraphs: true } } },
  })

  return NextResponse.json({
    ok: true,
    data: projects.map((p) => ({
      id: p.id,
      title: p.title,
      sourceType: p.sourceType,
      totalChars: p.totalChars,
      paragraphCount: p._count.paragraphs,
      createdAt: p.createdAt.toISOString(),
    })),
  })
}

// POST /api/projects — 创建项目（粘贴文本）
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''

  let title = '未命名论文'
  let sourceType: 'paste' | 'docx' = 'paste'
  let parsed: ReturnType<typeof splitIntoParagraphs> | null = null

  if (contentType.includes('multipart/form-data')) {
    // 上传 .docx 文件
    const formData = await req.formData()
    title = (formData.get('title') as string | null) ?? '未命名论文'
    sourceType = 'docx'
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ ok: false, code: 'MISSING_FILE', message: '请上传文件' }, { status: 400 })
    }
    // 校验文件类型：只接受 .docx
    const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (!file.name.toLowerCase().endsWith('.docx') && file.type !== DOCX_MIME) {
      return NextResponse.json(
        { ok: false, code: 'INVALID_FILE_TYPE', message: '仅支持 .docx 格式的 Word 文档' },
        { status: 400 },
      )
    }
    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json({ ok: false, code: 'FILE_TOO_LARGE', message: '文件不能超过 500MB' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    try {
      parsed = await parseDocx(buffer)
    } catch {
      return NextResponse.json({ ok: false, code: 'PARSE_FAILED', message: 'Word 文档解析失败' }, { status: 400 })
    }
  } else {
    // 粘贴文本
    const body = await req.json()
    const result = createProjectSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ ok: false, code: 'INVALID_PARAMS' }, { status: 400 })
    }
    title = result.data.title
    sourceType = result.data.sourceType
    if (!result.data.text?.trim()) {
      return NextResponse.json({ ok: false, code: 'MISSING_TEXT', message: '请输入文本' }, { status: 400 })
    }
    parsed = splitIntoParagraphs(result.data.text)
  }

  if (!parsed || parsed.paragraphs.length === 0) {
    return NextResponse.json({ ok: false, code: 'NO_PARAGRAPHS', message: '未识别到有效段落' }, { status: 400 })
  }

  // 创建项目和段落
  const project = await prisma.project.create({
    data: {
      userId,
      title,
      sourceType,
      totalChars: parsed.totalChars,
      paragraphs: {
        create: parsed.paragraphs.map((p) => ({
          index: p.index,
          original: p.text,
          charCount: p.charCount,
          status: 'pending',
        })),
      },
    },
    include: { _count: { select: { paragraphs: true } } },
  })

  return NextResponse.json({
    ok: true,
    data: {
      id: project.id,
      title: project.title,
      totalChars: project.totalChars,
      paragraphCount: project._count.paragraphs,
    },
  })
}
