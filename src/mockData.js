// 示例客户数据（全部为虚构示例）。实际项目中由 CRM、持仓、风险测评、产品中心等接口提供。
export const client = {
  org: '[机构名称]',
  name: '王先生（示例客户）',
  manager: '[理财经理姓名]',
  date: '2026年11月05日',
  age: 45,
  job: '企业主',
  family: '已婚，育有一子（16 岁，计划 2 年后出国留学）',
  income: 180,
  concerns: ['子女教育资金确定性', '家庭资产稳健增值', '企业与家庭资产适度隔离', '未来养老现金流'],
  assets: [
    { label: '现金及存款', amount: 260, kind: 'asset', financial: true, note: '流动性偏高' },
    { label: '固定收益类', amount: 180, kind: 'asset', financial: true, note: '银行理财为主' },
    { label: '权益类', amount: 120, kind: 'asset', financial: true, note: '个股集中度较高' },
    { label: '投资性房产', amount: 640, kind: 'asset', financial: false, note: '两套，流动性弱' },
    { label: '负债（房贷）', amount: 210, kind: 'debt', financial: false, note: '剩余 12 年' }
  ],
  risk: { level: 'C3 · 稳健型', date: '2026-10-28', maxDrawdown: '10%', horizon: '3–5 年', maxProduct: 'R3' },
  goals: [
    { name: '子女海外教育', when: '2028–2032', need: 300, have: 120 },
    { name: '退休养老补充', when: '2041 起', need: 800, have: 200 },
    { name: '家庭应急储备', when: '常备', need: 60, have: 260 }
  ],
  financialBase: 560,
  allocation: [
    { label: '现金类', current: 46, target: 5, color: '8FA3C0' },
    { label: '固收类', current: 32, target: 45, color: '2457C5' },
    { label: '权益类', current: 22, target: 25, color: 'E08A2E' },
    { label: '另类策略', current: 0, target: 10, color: '0E8A7E' },
    { label: '保障类', current: 0, target: 15, color: '7A5BB5' }
  ],
  products: [
    { name: '[产品A] 稳健配置集合资金信托', kind: '固收+', risk: 'R2', amount: 150 },
    { name: '[产品B] 中短债精选', kind: '纯债', risk: 'R2', amount: 102 },
    { name: '[产品C] 多策略 FOF', kind: '另类', risk: 'R3', amount: 56 },
    { name: '[产品D] 宽基指数增强', kind: '权益', risk: 'R3', amount: 140 },
    { name: '[产品E] 终身年金保险', kind: '保障', risk: '—', amount: 84 }
  ],
  scenarios: [
    { name: '基准情景', ret: '4.8%', dd: '-4.5%', goal: '可达成' },
    { name: '利率上行 100bp', ret: '3.6%', dd: '-6.2%', goal: '可达成' },
    { name: '权益市场下跌 30%', ret: '1.2%', dd: '-9.4%', goal: '需延后 1 年' }
  ]
}
