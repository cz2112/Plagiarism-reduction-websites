/**
 * 字符计费规则：
 * 先按提交正文中的汉字、字母和数字统计“计费字符数”，不计算空格与标点。
 * 再按所选等级倍率换算为实际扣费字符数（见 lib/modes.ts 的 billedChars）：
 *   普通降重 ×1.0，深度降重 ×1.8，至尊降重 ×3.0（向上取整）。
 * 生成前展示预计消耗；通过系统校验即扣费，与用户是否接受结果无关。
 * 每段（同一原文 + 同一等级）首次重试免费；生成失败不扣费。
 */

import { prisma } from './db'

/** 计算一段文本的计费字符数 */
export function countBillableChars(text: string): number {
  // 匹配汉字（含扩展区常用范围）、英文字母、数字，不计标点和空格
  const matches = text.match(/[一-鿿㐀-䶿a-zA-Z0-9]/g)
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
    const task = await tx.processTask.findUniqueOrThrow({ where: { id: taskId }, select: { credited: true } })
    if (task.credited) return
    const updated = await tx.user.updateMany({
      where: { id: userId, credits: { gte: charCount } },
      data: { credits: { decrement: charCount } },
    })
    if (updated.count !== 1) {
      throw new Error('INSUFFICIENT_CREDITS')
    }
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { credits: true } })
    const balanceBefore = user.credits + charCount

    await tx.usageLog.create({
      data: {
        userId,
        taskId,
        charCount,
        balanceBefore,
        balanceAfter: user.credits,
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
    const task = await tx.processTask.findUniqueOrThrow({ where: { id: taskId }, select: { credited: true } })
    if (!task.credited) return
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
    await tx.processTask.update({ where: { id: taskId }, data: { credited: false } })
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
    const granted = await tx.user.updateMany({
      where: { id: userId, freeUsed: false },
      data: {
        credits: { increment: freeChars },
        freeUsed: true,
      },
    })
    if (granted.count > 1) throw new Error('FREE_QUOTA_INVARIANT_VIOLATION')
  })
}

/** 充值（支付成功后调用） */
export async function addCredits(
  userId: string,
  orderId: string,
  charCount: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const paid = await tx.order.updateMany({
      where: { id: orderId, userId, status: 'pending' },
      data: { status: 'paid', paidAt: new Date() },
    })
    if (paid.count !== 1) return
    await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: charCount } },
    })
  })
}
