/**
 * AI 模型适配层
 * 统一接口，支持切换不同的模型供应商（OpenAI / DeepSeek / Zhipu / Qwen 等）
 * 所有接口均兼容 OpenAI Chat Completions API
 */

import OpenAI from 'openai'
import { AIProcessRequest, AIProcessResult, ProcessMode } from '@/types'
import { buildSystemPrompt, buildUserPrompt } from './prompts'
import { validateOutput } from './validator'

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

/** 调用 AI 模型处理单个段落 */
export async function processWithAI(req: AIProcessRequest): Promise<AIProcessResult> {
  const client = getClient()
  const model = process.env.AI_MODEL ?? 'gpt-4o-mini'
  const maxRetries = parseInt(process.env.AI_MAX_RETRIES ?? '2')

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(req.mode, req.lockedTerms) },
          { role: 'user', content: buildUserPrompt(req.original) },
        ],
        temperature: req.mode === 'conservative' ? 0.3 : 0.6,
        max_tokens: Math.max(req.original.length * 3, 1000), // 给足够的 token 空间
      })

      const result = response.choices[0]?.message?.content?.trim() ?? ''

      const validation = validateOutput(req.original, result, req.lockedTerms)

      if (!validation.passed && attempt < maxRetries) {
        // 校验失败，记录并重试
        console.warn(`[AI] 校验失败（第 ${attempt + 1} 次），重试...`, validation.details)
        continue
      }

      return {
        result,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
        },
      }
    } catch (err) {
      lastError = err as Error
      if (attempt < maxRetries) {
        // 网络/超时错误等待 1 秒后重试
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }

  throw lastError ?? new Error('AI_CALL_FAILED')
}

/** 返回当前配置的模型信息（用于后台监控） */
export function getModelInfo() {
  return {
    provider: process.env.AI_PROVIDER ?? 'openai',
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
    baseURL: process.env.AI_API_BASE_URL ?? 'https://api.openai.com/v1',
  }
}
