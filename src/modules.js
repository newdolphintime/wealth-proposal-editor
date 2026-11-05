// 模块定义与内容生成
// 每个模块生成的内容是一组结构化“块”（blocks），页面渲染和 Word 导出共用同一份数据，
// 用户在页面上修改的文字会写回块数据，因此导出的 Word 与页面内容一致。
//
// 块类型：
//   { type: 'cover', org, title, greeting, meta }
//   { type: 'h', text }                     章节标题
//   { type: 'p', text }                     正文段落
//   { type: 'note', text }                  小号说明文字
//   { type: 'table', head: [], rows: [[]], align: ['l'|'r'] }
//   { type: 'pie', title, items: [{ label, value, color }] }
//   { type: 'ol', items: [] }               有序列表

import { client } from './mockData.js'

export const LIBRARY = [
  { type: 'cover', name: '封面', desc: '机构、客户、理财经理、出具日期', single: true, source: 'CRM 客户主数据' },
  { type: 'profile', name: '客户画像', desc: '家庭结构、收入、关注重点', source: 'CRM 客户画像 / KYC 问卷' },
  { type: 'assets', name: '家庭资产负债现状', desc: '资产结构表与诊断结论', source: '行内持仓 + 客户申报他行资产' },
  { type: 'risk', name: '风险测评结果', desc: '风险等级及适当性说明', source: '风险测评系统' },
  { type: 'goals', name: '财务目标与缺口分析', desc: '教育、养老等目标资金缺口', source: '规划问卷 + 测算引擎' },
  { type: 'alloc', name: '资产配置建议', desc: '大类配置饼图与调整金额', source: '资产配置模型' },
  { type: 'products', name: '产品推荐清单', desc: '匹配风险等级的产品与金额', source: '产品中心货架' },
  { type: 'stress', name: '情景测算与压力测试', desc: '多情景收益、回撤与目标达成', source: '情景测算引擎' },
  { type: 'disclaimer', name: '风险揭示与免责声明', desc: '合规标准条款', single: true, required: true, source: '合规条款库' }
]

export const libraryItem = type => LIBRARY.find(l => l.type === type)

const pct = (v, total) => (v / total * 100).toFixed(1) + '%'

const GENERATORS = {
  cover: () => [{
    type: 'cover',
    org: `${client.org} · 私人财富管理`,
    title: '家庭财富规划建议书',
    greeting: `尊敬的 ${client.name}`,
    meta: `理财经理：${client.manager} · 出具日期：${client.date} · 有效期 30 天`
  }],

  profile: () => [
    { type: 'h', text: '客户画像' },
    { type: 'p', text: `${client.name}，${client.age} 岁，${client.job}，${client.family}。家庭年收入约 ${client.income} 万元，收入来源以经营所得为主，波动性较大。` },
    { type: 'p', text: `客户关注重点依次为：${client.concerns.join('、')}。` }
  ],

  assets: () => {
    const fin = client.assets.filter(a => a.kind === 'asset').reduce((s, a) => s + a.amount, 0)
    const debt = client.assets.filter(a => a.kind === 'debt').reduce((s, a) => s + a.amount, 0)
    const financial = client.assets.filter(a => a.financial).reduce((s, a) => s + a.amount, 0)
    return [
      { type: 'h', text: '家庭资产负债现状' },
      {
        type: 'table',
        head: ['类别', '金额（万元）', '占比', '说明'],
        align: ['l', 'r', 'r', 'l'],
        rows: client.assets.map(a => [
          a.label,
          a.kind === 'debt' ? '-' + a.amount : String(a.amount),
          a.kind === 'debt' ? '—' : pct(a.amount, fin),
          a.note
        ])
      },
      { type: 'p', text: `家庭金融资产 ${financial} 万元，净资产约 ${fin - debt} 万元。资产集中于房产，金融资产中现金沉淀偏多，权益持仓分散度不足。` }
    ]
  },

  risk: () => [
    { type: 'h', text: '风险测评结果' },
    { type: 'p', text: `客户风险承受能力评级为 ${client.risk.level}（测评日期 ${client.risk.date}，有效期 1 年）。可承受年度最大回撤约 ${client.risk.maxDrawdown}，投资期限以 ${client.risk.horizon} 为主。本建议书推荐产品风险等级均不高于 ${client.risk.maxProduct}。` }
  ],

  goals: () => [
    { type: 'h', text: '财务目标与缺口分析' },
    {
      type: 'table',
      head: ['目标', '时间', '资金需求（万元）', '现有储备', '缺口'],
      align: ['l', 'l', 'r', 'r', 'r'],
      rows: client.goals.map(g => [g.name, g.when, String(g.need), String(g.have), g.need > g.have ? String(g.need - g.have) : '—'])
    },
    { type: 'p', text: '教育金目标时间刚性、金额确定，建议优先以确定性较高的固收类资产锁定；养老目标期限较长，可适度提高权益与另类资产比例，追求长期增值。' }
  ],

  alloc: () => [
    { type: 'h', text: '资产配置建议' },
    { type: 'pie', title: '建议大类资产配置', items: client.allocation.map(a => ({ label: a.label, value: a.target, color: a.color })) },
    {
      type: 'table',
      head: ['大类资产', '当前', '建议', '调整（万元）'],
      align: ['l', 'r', 'r', 'r'],
      rows: client.allocation.map(a => {
        const delta = Math.round((a.target - a.current) / 100 * client.financialBase)
        return [a.label, a.current + '%', a.target + '%', (delta > 0 ? '+' : '') + delta]
      })
    },
    { type: 'p', text: `以金融资产 ${client.financialBase} 万元为基数：保留 6 个月支出作为应急现金，其余沉淀资金分批转入固收与多策略组合；教育金部分以确定性较高的固收类锁定；补充年金/寿险类保障，兼顾养老现金流与风险隔离。` }
  ],

  products: () => [
    { type: 'h', text: '产品推荐清单' },
    {
      type: 'table',
      head: ['产品名称', '类型', '风险等级', '建议金额（万元）'],
      align: ['l', 'l', 'l', 'r'],
      rows: client.products.map(p => [p.name, p.kind, p.risk, String(p.amount)])
    },
    { type: 'note', text: '以上产品均为示例，实际推荐以产品中心在售货架及客户适当性匹配结果为准。' }
  ],

  stress: () => [
    { type: 'h', text: '情景测算与压力测试' },
    {
      type: 'table',
      head: ['情景', '组合预期年化', '一年最大回撤', '教育金目标达成'],
      align: ['l', 'r', 'r', 'l'],
      rows: client.scenarios.map(s => [s.name, s.ret, s.dd, s.goal])
    },
    { type: 'note', text: '测算基于历史数据与模型假设，不代表未来收益。' }
  ],

  disclaimer: () => [
    { type: 'h', text: '风险揭示与免责声明' },
    {
      type: 'ol',
      items: [
        '本建议书基于客户提供的信息及测评结果编制，仅供参考，不构成任何收益承诺或投资要约。',
        '投资有风险，产品过往业绩不代表其未来表现，客户应认真阅读产品合同及风险揭示书。',
        '市场环境、客户情况发生变化时，建议重新评估并调整配置方案。',
        '[此处替换为机构合规部门审定的标准条款]'
      ]
    }
  ]
}

// 模拟调用后端生成接口：实际项目中替换为 fetch('/api/proposal/modules/:type/generate', ...)
export function generateModule (type, options = {}) {
  const delay = 700 + Math.random() * 900
  return new Promise(resolve => {
    setTimeout(() => resolve(JSON.parse(JSON.stringify(GENERATORS[type](options)))), delay)
  })
}
