import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'
import { WorkBench } from '@/components/editor/WorkBench'

interface Props {
  params: { id: string }
}

export default async function WorkbenchPage({ params }: Props) {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/login')

  const [project, user] = await Promise.all([
    prisma.project.findFirst({
      where: { id: params.id, userId, status: 'active' },
      include: {
        paragraphs: {
          orderBy: { index: 'asc' },
          include: {
            tasks: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { credits: true } }),
  ])

  if (!project) notFound()

  const paragraphs = project.paragraphs.map((p) => ({
    id: p.id,
    index: p.index,
    original: p.original,
    charCount: p.charCount,
    status: p.status as any,
    activeResult: p.activeResult,
    latestTask: p.tasks[0]
      ? {
          id: p.tasks[0].id,
          status: p.tasks[0].status as any,
          mode: p.tasks[0].mode as any,
          lockedTerms: p.tasks[0].lockedTerms,
          result: p.tasks[0].result,
          validationPassed: p.tasks[0].validationPassed,
          errorCode: p.tasks[0].errorCode,
          errorMessage: p.tasks[0].errorMessage,
          isFreeRetry: p.tasks[0].isFreeRetry,
          createdAt: p.tasks[0].createdAt.toISOString(),
        }
      : null,
  }))

  return (
    <div className="space-y-6">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/projects" className="hover:text-gray-800">我的论文</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{project.title}</span>
      </div>

      <WorkBench
        projectId={project.id}
        projectTitle={project.title}
        initialParagraphs={paragraphs}
        initialCredits={user?.credits ?? 0}
      />
    </div>
  )
}
