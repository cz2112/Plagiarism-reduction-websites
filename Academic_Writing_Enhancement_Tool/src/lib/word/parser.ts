/**
 * Word 文档解析
 * 使用 mammoth 将 .docx 转为纯文本，并按段落拆分
 */

import mammoth from 'mammoth'
import { countBillableChars } from '../billing'

export interface ParsedParagraph {
  index: number
  text: string
  charCount: number
}

export interface ParseResult {
  paragraphs: ParsedParagraph[]
  totalChars: number
  rawText: string
}

/**
 * 从 Buffer 解析 .docx 文件
 */
export async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  const { value: rawText } = await mammoth.extractRawText({ buffer })
  return splitIntoParagraphs(rawText)
}

/**
 * 将纯文本按段落拆分
 * 过滤掉空行，每个非空段落作为一个处理单元
 */
export function splitIntoParagraphs(text: string): ParseResult {
  const lines = text.split(/\r?\n/)
  const paragraphs: ParsedParagraph[] = []
  let totalChars = 0
  let index = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const charCount = countBillableChars(trimmed)

    paragraphs.push({
      index: index++,
      text: trimmed,
      charCount,
    })

    totalChars += charCount
  }

  return { paragraphs, totalChars, rawText: text }
}
