import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUserId } from '@/lib/session'
import { CreditsClient } from './CreditsClient'

export default async function CreditsPage() {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/login')

  const [user, dbPackages] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { credits: true } }),
    prisma.package.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ])

  return (
    <CreditsClient
      balance={user?.credits ?? 0}
      dbPackages={dbPackages.map((p) => ({
        id: p.id,
        name: p.name,
        chars: p.chars,
        priceFen: p.priceFen,
      }))}
    />
  )
}
