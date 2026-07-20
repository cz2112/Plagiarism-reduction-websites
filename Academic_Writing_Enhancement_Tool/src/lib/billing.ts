/**
 * 字符计费规则：
 * 按提交正文中的汉字、字母和数字计费，不计算空格与标点。
 * 生成前展示预计消耗；通过系统校验即扣费，与用户是否接受结果无关。
 * 每段首次重试免费。
 */

import { prisma } from './db'

/** 计算一段文本的计费字符数 */
export function countBillableChars(text: string): number {
  // 匹配汉字、英文字母、数字
  const matches = text.match(/[一-龥a-zA-Z0-9]/g)
  return matches ? matches.length : 0
}

/** 检查用户余额是否足够 */
export async function hasEnoughCredits(userId: string, required: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  })
  if (!user) return false
  return user.credits >= required
}

/** 扣除字符（原子操作，失败时抛出异常） */
export async function deductCredits(
  userId: string,
  taskId: string,
  charCount: number,
  reason: string = 'processed',
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, credits: true },
    })

    if (user.credits < charCount) {
      throw new Error('INSUFFICIENT_CREDITS')
    }

    const newBalance = user.credits - charCount

    await tx.user.update({
      where: { id: userId },
      data: { credits: newBalance },
    })

    await tx.usageLog.create({
      data: {
        userId,
        taskId,
        charCount,
        balanceBefore: user.credits,
        balanceAfter: newBalance,
        reason,
      },
    })

    await tx.processTask.update({
      where: { id: taskId },
      data: { credited: true },
    })
  })
}

/** 退还字符（生成失败时退还） */
export async function refundCredits(
  userId: string,
  taskId: string,
  charCount: number,
  reason: string = 'refund_failed',
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { credits: true },
    })

    const newBalance = user.credits + charCount

    await tx.user.update({
      where: { id: userId },
      data: { credits: newBalance },
    })

    await tx.usageLog.create({
      data: {
        userId,
        taskId,
        charCount: -charCount, // 负数表示退还
        balanceBefore: user.credits,
        balanceAfter: newBalance,
        reason,
      },
    })
  })
}

/** 判断某段落的首次重试是否已用掉（同一原文+同一模式） */
export async function isFreeRetryAvailable(
  paragraphId: string,
  mode: string,
): Promise<boolean> {
  const previousRetry = await prisma.processTask.findFirst({
    where: {
      paragraphId,
      mode,
      isFreeRetry: true,
      status: { in: ['done', 'failed', 'cancelled'] },
    },
  })
  return previousRetry === null
}

/** 给用户发放免费体验额度 */
export async function grantFreeQuota(userId: string): Promise<void> {
  const freeChars = parseInt(process.env.FREE_CHAR_QUOTA ?? '1000')
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { freeUsed: true, credits: true },
    })
    if (user.freeUsed) return

    await tx.user.update({
      where: { id: userId },
      data: {
        credits: user.credits + freeChars,
        freeUsed: true,
      },
    })
  })
}

/** 充值（支付成功后调用） */
export async function addCredits(
  userId: string,
  orderId: string,
  charCount: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: charCount } },
    })
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'paid', paidAt: new Date() },
    })
  })
}
