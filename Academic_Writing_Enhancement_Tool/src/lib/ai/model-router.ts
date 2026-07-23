/**
 * 模型路由（服务端唯一决定，前端只传 mode）
 *
 * 同一套接口、按等级路由不同模型：
 *   普通降重 standard → 轻量高速模型
 *   深度降重 deep     → 平衡模型
 *   至尊降重 premium  → 高质量模型
 *
 * 第一阶段共用同一服务商（同一 AI_API_KEY / AI_API_BASE_URL），
 * 只切换模型名与调用参数，便于统一鉴权、计费与日志。
 *
 * 等级差异来自「模型能力 + 提示词 + 输出约束」，不是只靠调高温度。
 */

import type { ProcessMode } from '@/types'
import { MODE_CONFIGS } from '@/lib/modes'

export interface ModelPlan {
  /** 主模型名 */
  model: string
  /** 采样温度 */
  temperature: number
  /** 主模型失败后的同模型重试次数（不含首次） */
  maxRetries: number
  /**
   * 主模型仍失败时降级到的模型名；null 表示不降级。
   * 至尊降重不自动降级，避免用户付高价却拿到低等级结果。
   */
  fallbackModel: string | null
}

function envNum(key: string, fallback: number): number {
  const raw = process.env[key]
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(n) ? n : fallback
}

function envFloat(key: string, fallback: number): number {
  const raw = process.env[key]
  const n = raw ? parseFloat(raw) : NaN
  return Number.isFinite(n) ? n : fallback
}

/**
 * 生产环境启动时调用，校验必需的模型配置是否已设置。
 * 开发环境允许回退到默认值；生产环境缺失时直接抛错，避免静默调用错误/昂贵模型。
 */
export function validateModelConfig(): void {
  if (process.env.NODE_ENV !== 'production') return
  const required = ['AI_API_KEY', 'AI_STANDARD_MODEL', 'AI_DEEP_MODEL', 'AI_PREMIUM_MODEL']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `[model-router] 生产环境缺少必需的模型配置：${missing.join(', ')}。` +
        '请在环境变量中配置后再启动。',
    )
  }
}

/**
 * 解析某等级的模型方案。
 * 模型名与参数均从环境变量读取，缺省时：
 *   开发环境 → 回退到内置默认（gpt-4o-mini / gpt-4o），允许本地快速启动
 *   生产环境 → validateModelConfig() 已在启动时拦截，不会走到此处的回退
 */
export function resolveModelPlan(mode: ProcessMode): ModelPlan {
  const standardModel = process.env.AI_STANDARD_MODEL ?? process.env.AI_MODEL ?? 'gpt-4o-mini'
  const deepModel     = process.env.AI_DEEP_MODEL     ?? process.env.AI_MODEL ?? 'gpt-4o'
  const premiumModel  = process.env.AI_PREMIUM_MODEL  ?? process.env.AI_MODEL ?? 'gpt-4o'

  const cfg = MODE_CONFIGS[mode]

  switch (mode) {
    case 'deep':
      return {
        model: deepModel,
        temperature: envFloat('AI_DEEP_TEMPERATURE', cfg.temperature),
        maxRetries: envNum('AI_DEEP_MAX_RETRIES', 2),
        fallbackModel: standardModel,
      }
    case 'premium':
      return {
        model: premiumModel,
        temperature: envFloat('AI_PREMIUM_TEMPERATURE', cfg.temperature),
        maxRetries: envNum('AI_PREMIUM_MAX_RETRIES', 2),
        fallbackModel: null,
      }
    case 'standard':
    default:
      return {
        model: standardModel,
        temperature: envFloat('AI_STANDARD_TEMPERATURE', cfg.temperature),
        maxRetries: envNum('AI_STANDARD_MAX_RETRIES', 1),
        fallbackModel: null,
      }
  }
}

/** 当前 AI 服务商标识（用于用量记录与后台监控） */
export function getProvider(): string {
  return process.env.AI_PROVIDER ?? 'openai'
}

/** 各等级最终使用的模型名（后台监控 / 健康检查用） */
export function getModelMatrix(): Record<ProcessMode, string> {
  return {
    standard: resolveModelPlan('standard').model,
    deep:     resolveModelPlan('deep').model,
    premium:  resolveModelPlan('premium').model,
  }
}
