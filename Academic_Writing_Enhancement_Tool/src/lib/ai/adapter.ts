/**
 * AI 模型适配层
 * 统一接口（OpenAI 兼容），按等级路由不同模型，编排同模型重试与按等级降级。
 * 所有等级共用同一质量校验器；等级差异来自「模型能力 + 提示词 + 输出约束」。
 *
 * 降级策略：
 *   deep  → 校验失败 或 API 硬错误（403/429/5xx/超时）→ 降级到 standard 模型跑一次
 *   premium → 任何失败都不降级，直接提示用户重新提交
 *   standard → 已是最低档，无降级
 *
 * fallbackAttempted: 是否尝试过备用模型（无论成败）
 * fallbackUsed:      最终结果是否来自备用模型（仅在备用成功时为 true）
 */

import OpenAI from 'openai'
import { AIProcessRequest, AIProcessResult } from '@/types'
import { buildSystemPrompt, buildUserPrompt } from './prompts'
import { validateOutput } from './validator'
import { getModeConfig } from '@/lib/modes'
import { resolveModelPlan, getProvider, getModelMatrix } from './model-router'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (_client) return _client
  _client = new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_API_BASE_URL ?? 'https://api.openai.com/v1',
    timeout: parseInt(process.env.AI_TIMEOUT_MS ?? '30000'),
    maxRetries: 0, // 我们自己控制重试
  })
  return _client
}

const MAX_TOKENS_CEILING = parseInt(process.env.AI_MAX_TOKENS ?? '8192')

interface SingleCall {
  result: string
  promptTokens: number
  completionTokens: number
}

/** 单次模型调用（不含重试/校验编排） */
async function callOnce(
  req: AIProcessRequest,
  model: string,
  temperature: number,
): Promise<SingleCall> {
  const client = getClient()
  const modeConfig = getModeConfig(req.mode)
  // 温度钳制在合法范围 [0, 2]
  const clampedTemp = Math.min(Math.max(temperature, 0), 2)
  // token 上限：原文长度×倍率，但不超过全局上限
  const maxTokens = Math.min(
    Math.max(req.original.length * modeConfig.maxTokenFactor, 1000),
    MAX_TOKENS_CEILING,
  )
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt(req.mode, req.lockedTerms) },
      { role: 'user', content: buildUserPrompt(req.original) },
    ],
    temperature: clampedTemp,
    max_tokens: maxTokens,
  })
  return {
    result: response.choices[0]?.message?.content?.trim() ?? '',
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
  }
}

interface Attempt {
  call: SingleCall
  passed: boolean
  details?: string
}

/**
 * 用某个模型跑「首次 + n 次同模型重试」。
 * 首个通过校验的结果立即返回；全部用完后返回最后一次内容（passed=false）。
 * 所有次都是 API 硬错误（从未拿到内容）→ 抛出最后一个异常，由调用方决定是否降级。
 */
async function runModel(
  req: AIProcessRequest,
  model: string,
  temperature: number,
  maxRetries: number,
): Promise<Attempt> {
  // 重试次数钳制，避免配置失误导致无限重试
  const retries = Math.min(Math.max(maxRetries, 0), 10)
  let last: Attempt | null = null
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const call = await callOnce(req, model, temperature)
      const validation = validateOutput(req.original, call.result, req.lockedTerms)
      last = { call, passed: validation.passed, details: validation.details }
      if (validation.passed) return last
      console.warn(`[AI] 校验失败（模型 ${model}，第 ${attempt + 1} 次）`, validation.details)
    } catch (err) {
      lastError = err as Error
      console.warn(`[AI] API 调用失败（模型 ${model}，第 ${attempt + 1} 次）`, lastError.message)
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }

  // 有内容但未通过校验 → 返回，由编排层决定是否降级
  if (last) return last
  // 从未拿到任何内容（全是硬错误）→ 上抛，编排层可触发降级
  throw lastError ?? new Error('AI_CALL_FAILED')
}

/**
 * 处理单个段落：按等级路由模型 → 同模型重试 → 必要时降级（仅 deep）。
 * 返回最终结果（含 validationPassed / fallbackAttempted / fallbackUsed / 用量），
 * 扣费与否由调用方按 validationPassed 决定。
 */
export async function processWithAI(req: AIProcessRequest): Promise<AIProcessResult> {
  const plan = resolveModelPlan(req.mode)
  const provider = getProvider()

  let primaryResult: Attempt | null = null
  let primaryError: Error | null = null

  // 1) 主模型（含同模型重试）
  try {
    primaryResult = await runModel(req, plan.model, plan.temperature, plan.maxRetries)
  } catch (err) {
    primaryError = err as Error
    console.error(`[AI] 主模型 ${plan.model} 硬错误`, primaryError.message)
  }

  // 无降级目标：直接返回主模型结果（或上抛硬错误）
  if (!plan.fallbackModel) {
    if (!primaryResult) throw primaryError ?? new Error('AI_CALL_FAILED')
    return toResult(primaryResult, plan.model, provider, false, false)
  }

  // 主模型通过校验 → 不需要降级
  if (primaryResult?.passed) {
    return toResult(primaryResult, plan.model, provider, false, false)
  }

  // 2) 触发降级（deep）：校验失败 或 API 硬错误 均可降级
  console.warn(`[AI] ${req.mode} 主模型未通过（${primaryError?.message ?? '校验失败'}），降级到 ${plan.fallbackModel}`)

  // 降级调用：使用 standard 等级的完整配置，仅调用一次（retries=0）
  const standardPlan = resolveModelPlan('standard')
  try {
    const fb = await runModel(req, plan.fallbackModel, standardPlan.temperature, 0)
    // fallbackAttempted=true，fallbackUsed=true（最终结果来自备用）
    return toResult(fb, plan.fallbackModel, provider, true, true)
  } catch (fbErr) {
    console.error(`[AI] 备用模型 ${plan.fallbackModel} 也失败`, (fbErr as Error).message)
    // 备用也彻底失败：
    //   - 若主模型有内容（校验未通过）→ 返回主模型内容，fallbackAttempted=true、fallbackUsed=false
    //   - 若主模型从未返回内容 → 上抛最后的错误
    if (primaryResult) {
      return toResult(primaryResult, plan.model, provider, true, false)
    }
    throw primaryError ?? fbErr
  }
}

function toResult(
  attempt: Attempt,
  model: string,
  provider: string,
  fallbackAttempted: boolean,
  fallbackUsed: boolean,
): AIProcessResult {
  return {
    result: attempt.call.result,
    usage: {
      promptTokens: attempt.call.promptTokens,
      completionTokens: attempt.call.completionTokens,
    },
    model,
    provider,
    validationPassed: attempt.passed,
    fallbackAttempted,
    fallbackUsed,
    validationDetails: attempt.details,
  }
}

/** 返回当前配置的模型信息（用于后台监控 / 健康检查） */
export function getModelInfo() {
  return {
    provider: getProvider(),
    baseURL: process.env.AI_API_BASE_URL ?? 'https://api.openai.com/v1',
    models: getModelMatrix(),
  }
}
