/**
 * 处理等级配置（唯一事实来源）
 *
 * 三档服务：普通降重 / 深度降重 / 至尊降重
 * 统一表述为“表达优化 / 改写强度”，不承诺具体查重结果。
 *
 * 计费方式：实际计费字符数 × 等级倍率（向上取整），失败不扣费。
 * 前后端、AI 层、计费层都从这里读取，避免各处硬编码不一致。
 */

import type { ProcessMode } from '@/types'

export interface ModeConfig {
  /** 枚举值 */
  value: ProcessMode
  /** 面向客户的名称 */
  label: string
  /** 一句话说明 */
  description: string
  /** 计费倍率：扣费 = 计费字符数 × 倍率 */
  multiplier: number
  /** 模型温度：越高改动幅度越大 */
  temperature: number
  /** 输出 token 上限相对原文长度的倍数（下限 1000） */
  maxTokenFactor: number
  /** 预计单段处理时间（秒），用于前端提示 */
  estimatedSeconds: number
  /** 适合场景（前端对比预览用） */
  suitableFor: string[]
}

export const MODE_CONFIGS: Record<ProcessMode, ModeConfig> = {
  standard: {
    value: 'standard',
    label: '普通降重',
    description: '降低重复表达，尽量保留原句结构',
    multiplier: 1.0,
    temperature: 0.3,
    maxTokenFactor: 3,
    estimatedSeconds: 20,
    suitableFor: ['原文基本通顺', '只是重复率偏高', '希望保留原有写作风格'],
  },
  deep: {
    value: 'deep',
    label: '深度降重',
    description: '重组句式和逻辑，明显改变表达方式',
    multiplier: 1.8,
    temperature: 0.6,
    maxTokenFactor: 3,
    estimatedSeconds: 30,
    suitableFor: ['普通改写不够明显', '句式和表达重复较多', '需要调整段内逻辑'],
  },
  premium: {
    value: 'premium',
    label: '至尊降重',
    description: '大幅优化表达，提升论文整体学术风格',
    multiplier: 3.0,
    temperature: 0.75,
    maxTokenFactor: 4,
    estimatedSeconds: 45,
    suitableFor: ['需要较大幅度重写', '原文较口语化或机械', '希望更接近成熟论文风格'],
  },
}

/** 全部等级（按强度排序），供前端遍历 */
export const MODE_LIST: ModeConfig[] = [
  MODE_CONFIGS.standard,
  MODE_CONFIGS.deep,
  MODE_CONFIGS.premium,
]

export const DEFAULT_MODE: ProcessMode = 'standard'

/** 合法的等级枚举值（供 zod / 校验使用） */
export const MODE_VALUES = ['standard', 'deep', 'premium'] as const

/** 兼容 1.1.x 的旧枚举值，用于展示历史任务 */
const LEGACY_MODE_MAP: Record<string, ProcessMode> = {
  conservative: 'standard',
  polish: 'deep',
}

/** 把任意（含历史）mode 值归一化为当前枚举 */
export function normalizeMode(mode: string): ProcessMode {
  if (mode in MODE_CONFIGS) return mode as ProcessMode
  return LEGACY_MODE_MAP[mode] ?? DEFAULT_MODE
}

/** 取等级配置（对未知值回退到普通降重） */
export function getModeConfig(mode: string): ModeConfig {
  return MODE_CONFIGS[normalizeMode(mode)]
}

/** 按等级计算实际扣费字符数：计费字符数 × 倍率，向上取整 */
export function billedChars(billableChars: number, mode: string): number {
  return Math.ceil(billableChars * getModeConfig(mode).multiplier)
}
