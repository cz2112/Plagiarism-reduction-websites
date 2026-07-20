/**
 * 质量自动校验器
 * 检查 AI 输出是否满足规则，不满足则自动重试一次
 */

import { ValidationResult } from '@/types'

/** 从文本中提取数字和单位字符串（如 35%、100万、p<0.05、2024年） */
function extractNumbers(text: string): string[] {
  const pattern = /\d+(\.\d+)?(%|万|亿|元|年|月|日|个|人|次|项|篇|千|百)?|p\s*[<>=]\s*0\.\d+/g
  return text.match(pattern) ?? []
}

/** 从文本中提取引用编号（如 [1]、[2,3]、[1-3]） */
function extractCitations(text: string): string[] {
  const pattern = /\[\d+[\d,\-\s]*\]/g
  return text.match(pattern) ?? []
}

/** 规范化字符串以便比较（去除多余空格） */
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * 校验 AI 输出
 */
export function validateOutput(
  original: string,
  result: string,
  lockedTerms: string[],
): ValidationResult {
  const checks = {
    termsPreserved: true,
    numbersPreserved: true,
    citationsPreserved: true,
    notEmpty: true,
    notTruncated: true,
    noExtraExplanation: true,
  }

  const details: string[] = []

  // 1. 非空检查
  if (!result || normalize(result).length === 0) {
    checks.notEmpty = false
    details.push('输出为空')
  }

  // 2. 输出不能过短（不超过原文的 30%，除非原文本来就很短）
  if (original.length > 50 && result.length < original.length * 0.3) {
    checks.notTruncated = false
    details.push(`输出过短：原文 ${original.length} 字符，输出 ${result.length} 字符`)
  }

  // 3. 锁定术语检查
  for (const term of lockedTerms) {
    if (!result.includes(term)) {
      checks.termsPreserved = false
      details.push(`锁定术语丢失："${term}"`)
    }
  }

  // 4. 数字保留检查
  const originalNumbers = extractNumbers(original)
  for (const num of originalNumbers) {
    if (!result.includes(num)) {
      checks.numbersPreserved = false
      details.push(`数字/单位丢失："${num}"`)
    }
  }

  // 5. 引用编号检查
  const originalCitations = extractCitations(original)
  for (const citation of originalCitations) {
    if (!result.includes(citation)) {
      checks.citationsPreserved = false
      details.push(`引用编号丢失："${citation}"`)
    }
  }

  // 6. 检查是否包含多余的解释性内容
  const explanationPatterns = [
    /^修改[如结果后：：]/,
    /^优化[结果后如：：]/,
    /^润色[结果后如：：]/,
    /^以下是/,
    /^改写[结果后：：]/,
  ]
  for (const pattern of explanationPatterns) {
    if (pattern.test(result.trim())) {
      checks.noExtraExplanation = false
      details.push('输出包含多余的解释性前缀')
      break
    }
  }

  const passed = Object.values(checks).every(Boolean)

  return {
    passed,
    checks,
    details: details.length > 0 ? details.join('; ') : undefined,
  }
}
