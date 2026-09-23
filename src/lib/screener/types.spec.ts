/**
 * screener types 字段字典自检
 *
 * 覆盖：
 * - FIELD_DEFINITIONS 必须覆盖 SCREENER_FIELDS 的全部 12 个字段
 * - 每个字段必须落在 4 个 category 之一
 * - enum 字段必须有 enumValues 且 enumValues 非空
 * - boolean / number 字段不允许出现 enumValues
 * - getFieldsByCategory 返回值一致
 *
 * 通过 ambient describe/it/expect 声明保持 pnpm tsc 通过
 * （项目当前无前端测试运行时；详见 src/lib/use-animated-number.spec.ts 注释）
 */

import {
  CATEGORY_LABELS,
  FIELD_DEFINITIONS,
  FIELD_LABELS,
  FILTER_OPS,
  OP_LABELS,
  SCREENER_CATEGORIES,
  SCREENER_COMBINATORS,
  SCREENER_FIELDS,
  SORT_ORDERS,
  getFieldsByCategory,
} from './types'

/* eslint-disable @typescript-eslint/no-unused-vars */
declare const describe: (name: string, fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: (val: unknown) => {
  toBe: (expected: unknown) => void
  toEqual: (expected: unknown) => void
  toBeTruthy: () => void
  toBeDefined: () => void
  toBeUndefined: () => void
  toContain: (expected: unknown) => void
}

describe('FIELD_DEFINITIONS 完整性', () => {
  it('恰好覆盖 12 个字段', () => {
    expect(SCREENER_FIELDS.length).toBe(12)
    expect(Object.keys(FIELD_DEFINITIONS).length).toBe(12)
  })

  it('SCREENER_FIELDS 与 FIELD_DEFINITIONS 的 key 一一对应', () => {
    for (const f of SCREENER_FIELDS) {
      expect(FIELD_DEFINITIONS[f]).toBeDefined()
    }
  })

  it('每个字段都落在 4 个 category 之一', () => {
    for (const f of SCREENER_FIELDS) {
      const cat = FIELD_DEFINITIONS[f].category
      expect(SCREENER_CATEGORIES).toContain(cat)
    }
  })

  it('4 个 category 都有字段', () => {
    for (const cat of SCREENER_CATEGORIES) {
      const arr = getFieldsByCategory(cat as never)
      expect(arr.length).toBeTruthy()
    }
  })
})

describe('FIELD_DEFINITIONS 数据形状', () => {
  it('enum 字段必须有 enumValues 且非空', () => {
    for (const f of SCREENER_FIELDS) {
      const def = FIELD_DEFINITIONS[f]
      if (def.valueType === 'enum') {
        expect(def.enumValues).toBeDefined()
        expect((def.enumValues as readonly string[]).length).toBeTruthy()
      }
    }
  })

  it('boolean / number 字段不应有 enumValues', () => {
    for (const f of SCREENER_FIELDS) {
      const def = FIELD_DEFINITIONS[f]
      if (def.valueType === 'number' || def.valueType === 'boolean') {
        expect(def.enumValues).toBeUndefined()
      }
    }
  })

  it('technical 类字段的 ops 只允许 "="', () => {
    for (const f of SCREENER_FIELDS) {
      const def = FIELD_DEFINITIONS[f]
      if (def.category === 'technical') {
        expect(def.ops.length).toBe(1)
        expect(def.ops[0]).toBe('=')
      }
    }
  })

  it('number 类字段允许全部 ops', () => {
    for (const f of SCREENER_FIELDS) {
      const def = FIELD_DEFINITIONS[f]
      if (def.valueType === 'number') {
        // 至少包含 > 和 <
        expect(def.ops).toContain('>')
        expect(def.ops).toContain('<')
      }
    }
  })
})

describe('常量白名单', () => {
  it('FILTER_OPS / SCREENER_COMBINATORS / SORT_ORDERS 各自非空', () => {
    expect(FILTER_OPS.length).toBeTruthy()
    expect(SCREENER_COMBINATORS.length).toBe(2)
    expect(SORT_ORDERS.length).toBe(2)
  })

  it('FIELD_LABELS 与 FIELD_DEFINITIONS 一一对应', () => {
    for (const f of SCREENER_FIELDS) {
      expect(FIELD_LABELS[f]).toBeDefined()
    }
  })

  it('CATEGORY_LABELS 覆盖所有 category', () => {
    for (const c of SCREENER_CATEGORIES) {
      expect(CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS]).toBeDefined()
    }
  })

  it('OP_LABELS 覆盖所有 op', () => {
    for (const op of FILTER_OPS) {
      expect(OP_LABELS[op]).toBeDefined()
    }
  })
})
