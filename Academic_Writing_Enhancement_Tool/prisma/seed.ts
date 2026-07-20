/**
 * 初始化字数套餐数据
 * 运行：npx prisma db seed
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const packages = [
  { name: '小份套餐', chars: 5000,   priceFen: 990,  sortOrder: 1 },
  { name: '标准套餐', chars: 20000,  priceFen: 2990, sortOrder: 2 },
  { name: '大份套餐', chars: 50000,  priceFen: 5990, sortOrder: 3 },
  { name: '专业套餐', chars: 100000, priceFen: 9990, sortOrder: 4 },
]

async function main() {
  console.log('初始化套餐数据...')
  for (const pkg of packages) {
    const existing = await prisma.package.findFirst({ where: { name: pkg.name } })
    if (existing) {
      await prisma.package.update({ where: { id: existing.id }, data: pkg })
    } else {
      await prisma.package.create({ data: pkg })
    }
  }
  console.log('完成。')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
