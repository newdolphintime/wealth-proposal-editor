// Word 导出：把结构化块数据转成 .docx。
// 为避免“跳页”的尴尬，这里统一设置了 Word 的分页控制属性：
//   - 标题：与下段同页（keepNext）+ 段中不分页（keepLines），标题不会孤零零落在页底
//   - 正文：孤行控制（widowControl）
//   - 表格：行不跨页断开（cantSplit）、表头跨页重复（tableHeader）；
//           8 行以内的小表整体绑定在同一页（除最后一行外每行 keepNext）
//   - 图表：图题 + 图片 + 图例绑定在同一页；图片用嵌入型（inline），不会漂移
//   - 封面后另起一页用“段前分页”（pageBreakBefore），不插空段落和硬分页符
//   - 空段落不导出（用户清空的段落直接跳过），避免出现空白页
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, ShadingType, BorderStyle, ImageRun, Header, Footer,
  PageNumber, LevelFormat, LineRuleType
} from 'docx'

const FONT = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' }
const INK = '1A2233'
const MUTED = '5B6577'
const LINE = 'C9D0DB'
const SMALL_TABLE_ROWS = 8

const clean = s => String(s ?? '').replace(/ /g, ' ').replace(/\n{2,}/g, '\n').trim()

// 段落文本中的换行转成 Word 软换行
function runs (text, opts = {}) {
  const lines = clean(text).split('\n')
  return lines.map((t, i) => new TextRun({ text: t, break: i > 0 ? 1 : 0, ...opts }))
}

function cell (text, { header = false, align = 'l', keepNext = false } = {}) {
  return new TableCell({
    shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF1F5' } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    children: [new Paragraph({
      alignment: align === 'r' ? AlignmentType.RIGHT : AlignmentType.LEFT,
      keepNext,
      keepLines: true,
      children: runs(text, { bold: header, color: header ? MUTED : INK, size: 19 })
    })]
  })
}

function table (block) {
  const small = block.rows.length <= SMALL_TABLE_ROWS
  const border = { style: BorderStyle.SINGLE, size: 4, color: LINE }
  const rows = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: block.head.map((h, i) => cell(h, { header: true, align: block.align[i], keepNext: true }))
    }),
    ...block.rows.map((r, ri) => new TableRow({
      cantSplit: true,
      children: r.map((c, ci) => cell(c, { align: block.align[ci], keepNext: small && ri < block.rows.length - 1 }))
    }))
  ]
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows
  })
}

// 用 canvas 把饼图画成 PNG（2 倍分辨率，保证打印清晰）
async function piePng (block) {
  const size = 320
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = size * scale
  canvas.height = size * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  const total = block.items.reduce((s, i) => s + i.value, 0)
  let start = -Math.PI / 2
  block.items.forEach(it => {
    const angle = it.value / total * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(size / 2, size / 2)
    ctx.arc(size / 2, size / 2, size / 2 - 4, start, start + angle)
    ctx.closePath()
    ctx.fillStyle = '#' + it.color
    ctx.fill()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.stroke()
    start += angle
  })
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五']

async function blockToDocx (block, ctx) {
  switch (block.type) {
    case 'cover':
      return [
        new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: runs(block.org, { color: MUTED, size: 22 }) }),
        new Paragraph({ spacing: { before: 400, after: 400 }, alignment: AlignmentType.CENTER, children: runs(block.title, { bold: true, size: 52, color: '12233F' }) }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: runs(block.greeting, { size: 28 }) }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: runs(block.meta, { color: MUTED, size: 20 }) })
      ]
    case 'h': {
      const prefix = ctx.numbered ? CN_NUM[ctx.chapter++] + '、' : ''
      return [new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: ctx.pageBreakNext,
        keepNext: true,
        keepLines: true,
        children: runs(prefix + block.text)
      })]
    }
    case 'p':
      return clean(block.text) ? [new Paragraph({ widowControl: true, spacing: { after: 120, line: 360, lineRule: LineRuleType.AUTO }, children: runs(block.text) })] : []
    case 'note':
      return clean(block.text) ? [new Paragraph({ widowControl: true, spacing: { before: 60, after: 120 }, children: runs(block.text, { size: 17, color: MUTED }) })] : []
    case 'table':
      return [table(block), new Paragraph({ spacing: { after: 80 }, children: [] })]
    case 'pie': {
      const data = await piePng(block)
      return [
        new Paragraph({ keepNext: true, alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: runs(block.title, { bold: true, size: 20 }) }),
        new Paragraph({ keepNext: true, alignment: AlignmentType.CENTER, spacing: { line: 240, lineRule: LineRuleType.AUTO }, children: [new ImageRun({ type: 'png', data, transformation: { width: 180, height: 180 } })] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
          children: block.items.flatMap((it, i) => [
            new TextRun({ text: (i ? '    ' : '') + '■ ', color: it.color, size: 20 }),
            new TextRun({ text: `${it.label} ${it.value}%`, size: 19, color: INK })
          ])
        })
      ]
    }
    case 'ol':
      return block.items.filter(t => clean(t)).map(t => new Paragraph({
        numbering: { reference: 'ol', level: 0, instance: ctx.olInstance },
        widowControl: true,
        spacing: { after: 80 },
        children: runs(t, { size: 19 })
      }))
    default:
      return []
  }
}

export async function buildDocx (mods, { title = '家庭财富规划建议书', clientName = '' } = {}) {
  const children = []
  const ctx = { chapter: 0, numbered: true, pageBreakNext: false, olInstance: 0 }

  for (const m of mods) {
    ctx.numbered = m.type !== 'cover' && m.type !== 'disclaimer'
    let first = true
    for (const block of m.blocks) {
      if (block.type === 'ol') ctx.olInstance++
      const out = await blockToDocx(block, ctx)
      if (first && out.length && ctx.pageBreakNext && block.type !== 'h') {
        // 封面后的模块首块不是标题时，用段前分页另起一页
        out.unshift(new Paragraph({ pageBreakBefore: true, children: [] }))
      }
      if (out.length) { first = false; ctx.pageBreakNext = false }
      children.push(...out)
    }
    if (m.type === 'cover') ctx.pageBreakNext = true
  }

  const doc = new Document({
    creator: '财富规划建议书编辑器',
    title,
    styles: {
      default: {
        document: { run: { font: FONT, size: 21, color: INK }, paragraph: { spacing: { line: 336, lineRule: LineRuleType.AUTO } } },
        heading1: {
          run: { font: FONT, size: 30, bold: true, color: '12233F' },
          paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, keepLines: true }
        }
      }
    },
    numbering: {
      config: [{
        reference: 'ol',
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 300 } } } }]
      }]
    },
    sections: [{
      properties: {
        titlePage: true,
        page: { margin: { top: 1440, bottom: 1440, left: 1300, right: 1300 } }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
            children: [new TextRun({ text: `${title}${clientName ? ' · ' + clientName : ''}`, size: 16, color: MUTED })]
          })]
        }),
        first: new Header({ children: [new Paragraph({ children: [] })] })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: ['第 ', PageNumber.CURRENT, ' 页 / 共 ', PageNumber.TOTAL_PAGES, ' 页'], size: 16, color: MUTED })]
          })]
        }),
        first: new Footer({ children: [new Paragraph({ children: [] })] })
      },
      children
    }]
  })
  return Packer.toBlob(doc)
}
