/**
 * Word 文档导出
 * 使用 docx 库将修改后的段落导出为 .docx 文件
 * 首版导出"干净版本"（不含修订标记）
 */

import {
  Document,
  Paragraph as DocxParagraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
} from 'docx'

export interface ExportParagraph {
  text: string
  isHeading?: boolean
  headingLevel?: 1 | 2 | 3
}

/**
 * 将段落列表导出为 .docx Buffer
 */
export async function exportToDocx(
  title: string,
  paragraphs: ExportParagraph[],
): Promise<Buffer> {
  const children: DocxParagraph[] = paragraphs.map((p) => {
    if (p.isHeading && p.headingLevel) {
      const levelMap: Record<number, HeadingLevel> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
      }
      return new DocxParagraph({
        text: p.text,
        heading: levelMap[p.headingLevel] ?? HeadingLevel.HEADING_2,
      })
    }

    return new DocxParagraph({
      children: [
        new TextRun({
          text: p.text,
          size: 24, // 12pt
          font: 'SimSun', // 宋体，学术论文常用字体
        }),
      ],
      spacing: { after: 200 },
      alignment: AlignmentType.JUSTIFIED,
    })
  })

  const doc = new Document({
    creator: '文清AI',
    title,
    sections: [
      {
        children,
      },
    ],
  })

  return Buffer.from(await Packer.toBuffer(doc))
}
