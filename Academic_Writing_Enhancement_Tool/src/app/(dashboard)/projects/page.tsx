import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'
import { redirect } from 'next/navigation'
import { ProjectsClient } from './ProjectsClient'

export default async function ProjectsPage() {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/login')

  const projects = await prisma.project.findMany({
    where: { userId, status: 'active' },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { paragraphs: true } } },
  })

  return (
    <ProjectsClient
      projects={projects.map((p) => ({
        id: p.id,
        title: p.title,
        sourceType: p.sourceType,
        totalChars: p.totalChars,
        paragraphCount: p._count.paragraphs,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  )
}
