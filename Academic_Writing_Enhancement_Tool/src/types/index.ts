// ── 通用枚举 ──────────────────────────────────────────

export type ProcessMode = 'conservative' | 'polish'

export type ParagraphStatus =
  | 'pending'
  | 'processing'
  | 'done'
  | 'error'
  | 'accepted'
  | 'reverted'

export type TaskStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export type OrderStatus = 'pending' | 'paid' | 'refunded' | 'cancelled'

// ── 请求/响应 DTO ─────────────────────────────────────

export interface CreateProjectRequest {
  title: string
  sourceType: 'paste' | 'docx'
  text?: string // sourceType=paste 时传入
}

export interface ProcessRequest {
  paragraphId: string
  mode: ProcessMode
  lockedTerms: string[]
}

export interface ProcessResponse {
  taskId: string
}

// ── 前端展示用 ────────────────────────────────────────

export interface ParagraphView {
  id: string
  index: number
  original: string
  charCount: number
  status: ParagraphStatus
  activeResult: string | null
  latestTask?: TaskView | null
}

export interface TaskView {
  id: string
  status: TaskStatus
  mode: ProcessMode
  lockedTerms: string[]
  result: string | null
  validationPassed: boolean | null
  errorCode: string | null
  errorMessage: string | null
  isFreeRetry: boolean
  createdAt: string
}

export interface ProjectView {
  id: string
  title: string
  sourceType: string
  totalChars: number
  paragraphCount: number
  createdAt: string
}

export interface UserBalance {
  credits: number
  freeUsed: boolean
}

// ── 计费 ──────────────────────────────────────────────

export interface CreditPackage {
  id: string
  name: string
  chars: number
  priceFen: number
  priceYuan: string // 格式化后的价格字符串
}

// ── AI 层内部类型 ──────────────────────────────────────

export interface AIProcessRequest {
  original: string
  mode: ProcessMode
  lockedTerms: string[]
}

export interface AIProcessResult {
  result: string
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

export interface ValidationResult {
  passed: boolean
  checks: {
    termsPreserved: boolean
    numbersPreserved: boolean
    citationsPreserved: boolean
    notEmpty: boolean
    notTruncated: boolean
    noExtraExplanation: boolean
  }
  details?: string
}

// ── API 统一响应格式 ──────────────────────────────────

export interface ApiOk<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  code: string
  message: string
}

export type ApiResponse<T> = ApiOk<T> | ApiError
