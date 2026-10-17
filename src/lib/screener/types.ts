/**
 * 条件选股器前端类型契约
 *
 * 设计要点：
 * - 与 server/src/screener/schema.ts 的 Zod 校验保持一一对应
 * - 不引入 zod 依赖（保持前端包体干净），仅做类型 + 字段字典镜像
 * - FIELD_DEFINITIONS 是前端组件（输入控件、op 选择、enum 下拉）的唯一事实源
 *
 * 修改字段字典时，请同步 server/src/screener/schema.ts，避免前后端漂移。
 */

// ---------------------------------------------------------------------------
// 字段白名单与字段字典
// ---------------------------------------------------------------------------

export const SCREENER_FIELDS = [
  // fundamental (3)
  'pe',
  'pb',
  'marketCap',
  // quote (4)
  'changePct',
  'turnoverRate',
  'volumeRatio',
  'consecutiveLimitUp',
  // technical (3)
  'macdSignal',
  'kdjZone',
  'bollBand',
  // pattern (2)
  'maAlignment',
  'resonance',
] as const

export const SCREENER_CATEGORIES = [
  'fundamental',
  'quote',
  'technical',
  'pattern',
] as const

export type ScreenerCategory = (typeof SCREENER_CATEGORIES)[number]

export type ScreenerField = (typeof SCREENER_FIELDS)[number]

export type ScreenerDataSource =
  | 'daily_basic'
  | 'daily_quote'
  | 'indicator'
  | 'pattern_engine'

export type FieldValueType = 'number' | 'enum' | 'boolean'

/**
 * 字段中文展示名（前端 label）
 * - 与 FIELD_DEFINITIONS 配合使用，避免组件内散落字符串
 */
export const FIELD_LABELS: Record<ScreenerField, string> = {
  pe: '市盈率 PE',
  pb: '市净率 PB',
  marketCap: '总市值',
  changePct: '涨跌幅',
  turnoverRate: '换手率',
  volumeRatio: '量比',
  consecutiveLimitUp: '连板数',
  macdSignal: 'MACD 信号',
  kdjZone: 'KDJ 区域',
  bollBand: '布林带位置',
  maAlignment: '均线排列',
  resonance: '多周期共振',
}

export const CATEGORY_LABELS: Record<ScreenerCategory, string> = {
  fundamental: '基本面',
  quote: '行情',
  technical: '技术',
  pattern: '形态',
}

export interface FieldDefinition {
  /** 字段类别（用于前端分组展示） */
  category: ScreenerCategory
  /** 数据来源（下游 service 据此决定从哪个 store 取数） */
  dataSource: ScreenerDataSource
  /** 该字段允许使用的比较操作符 */
  ops: readonly FilterOp[]
  /** value 的类型，配合 ops 决定具体 UI 控件 */
  valueType: FieldValueType
  /** enum 字段的字面量白名单（仅 valueType === 'enum' 时存在） */
  enumValues?: readonly string[]
  /** enum/boolean 字段的展示标签映射（可选） */
  enumLabels?: Record<string, string>
}

// ---------------------------------------------------------------------------
// 操作符 / 组合符
// ---------------------------------------------------------------------------

export const FILTER_OPS = ['>', '<', '>=', '<=', '=', 'between', 'in'] as const
export type FilterOp = (typeof FILTER_OPS)[number]

export const OP_LABELS: Record<FilterOp, string> = {
  '>': '大于',
  '<': '小于',
  '>=': '大于等于',
  '<=': '小于等于',
  '=': '等于',
  between: '区间',
  in: '包含',
}

export const SCREENER_COMBINATORS = ['AND', 'OR'] as const
export type ScreenerCombinator = (typeof SCREENER_COMBINATORS)[number]

export const SORT_ORDERS = ['asc', 'desc'] as const
export type SortOrder = (typeof SORT_ORDERS)[number]

// ---------------------------------------------------------------------------
// 字段字典：12 个字段的元数据
// ---------------------------------------------------------------------------

export const FIELD_DEFINITIONS: Record<ScreenerField, FieldDefinition> = {
  pe: { category: 'fundamental', dataSource: 'daily_basic', ops: FILTER_OPS, valueType: 'number' },
  pb: { category: 'fundamental', dataSource: 'daily_basic', ops: FILTER_OPS, valueType: 'number' },
  marketCap: { category: 'fundamental', dataSource: 'daily_basic', ops: FILTER_OPS, valueType: 'number' },

  changePct: { category: 'quote', dataSource: 'daily_quote', ops: FILTER_OPS, valueType: 'number' },
  turnoverRate: { category: 'quote', dataSource: 'daily_basic', ops: FILTER_OPS, valueType: 'number' },
  volumeRatio: { category: 'quote', dataSource: 'daily_quote', ops: FILTER_OPS, valueType: 'number' },
  consecutiveLimitUp: { category: 'quote', dataSource: 'pattern_engine', ops: FILTER_OPS, valueType: 'number' },

  macdSignal: {
    category: 'technical',
    dataSource: 'indicator',
    ops: ['='],
    valueType: 'enum',
    enumValues: ['golden', 'death'],
    enumLabels: { golden: '金叉', death: '死叉' },
  },
  kdjZone: {
    category: 'technical',
    dataSource: 'indicator',
    ops: ['='],
    valueType: 'enum',
    enumValues: ['oversold', 'overbought'],
    enumLabels: { oversold: '超卖', overbought: '超买' },
  },
  bollBand: {
    category: 'technical',
    dataSource: 'indicator',
    ops: ['='],
    valueType: 'enum',
    enumValues: ['upper_break', 'lower_break'],
    enumLabels: { upper_break: '突破上轨', lower_break: '跌破下轨' },
  },

  maAlignment: {
    category: 'pattern',
    dataSource: 'pattern_engine',
    ops: ['='],
    valueType: 'enum',
    enumValues: ['bull', 'bear', 'mixed'],
    enumLabels: { bull: '多头排列', bear: '空头排列', mixed: '缠绕' },
  },
  resonance: {
    category: 'pattern',
    dataSource: 'pattern_engine',
    ops: ['='],
    valueType: 'boolean',
    enumLabels: { true: '是', false: '否' },
  },
}

// ---------------------------------------------------------------------------
// Condition：{ field, op, value }
// ---------------------------------------------------------------------------

export interface Condition {
  field: ScreenerField
  op: FilterOp
  /**
   * value 类型与 field.valueType 对应：
   * - number / between / in: number | number[]
   * - enum: string
   * - boolean: boolean
   */
  value: number | number[] | string | boolean
}

export interface ScreenerSort {
  field: ScreenerField
  order: SortOrder
}

// ---------------------------------------------------------------------------
// 响应行 / 请求响应
// ---------------------------------------------------------------------------

export interface ScreenerItem {
  symbol: string
  name: string
  price: number
  changePct: number
  turnoverRate?: number
  volumeRatio?: number
  pe?: number
  pb?: number
  marketCap?: number
  consecutiveLimitUp?: number
  macdSignal?: string
  kdjZone?: string
  bollBand?: string
  maAlignment?: string
  resonance?: boolean
}

export interface ScreenerResponse {
  items: ScreenerItem[]
  total: number
  page: number
  pageSize: number
  combinator: ScreenerCombinator
}

// ---------------------------------------------------------------------------
// 预设（前端持久化）
// ---------------------------------------------------------------------------

export interface Preset {
  id: string
  name: string
  combinator: ScreenerCombinator
  conditions: Condition[]
  sort: ScreenerSort
  /** ISO timestamp */
  createdAt: string
}

/**
 * localStorage 命名空间：screener_presets
 * 序列化形态：{ version: 1, presets: Preset[] }
 */
export const PRESETS_STORAGE_KEY = 'screener_presets'
export const PRESETS_SCHEMA_VERSION = 1

/**
 * 按 category 分组当前可见字段（用于 ConditionBuilder Tab 渲染）
 */
export function getFieldsByCategory(category: ScreenerCategory): ScreenerField[] {
  return (Object.keys(FIELD_DEFINITIONS) as ScreenerField[]).filter(
    (f) => FIELD_DEFINITIONS[f].category === category,
  )
}
