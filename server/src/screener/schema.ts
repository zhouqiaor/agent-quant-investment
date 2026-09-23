import { z } from 'zod';

/**
 * 条件选股器 Phase 1：Schema + 字段字典
 *
 * 本文件是选股器的契约层，不依赖任何服务/数据库。
 * 后续 service/controller/page 全部以本文件导出的 Zod schema 和 TypeScript 类型为准。
 *
 * 设计要点：
 * - 字段字典（FIELD_DEFINITIONS）单一事实源：声明 category / dataSource / ops / valueType
 * - Condition 用 superRefine 校验 value 与 field 类型匹配，避免下游 service 再次重复
 * - 限制 groups ≤ 8，pageSize ≤ 100，避免大查询拖垮行情接口
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
] as const;

export type ScreenerField = (typeof SCREENER_FIELDS)[number];

export type ScreenerCategory = 'fundamental' | 'quote' | 'technical' | 'pattern';

export type ScreenerDataSource =
  | 'daily_basic' // Tushare daily_basic：pe/pb/marketCap/turnoverRate
  | 'daily_quote' // Tushare daily：changePct/volumeRatio
  | 'indicator' // 本地指标引擎：macdSignal/kdjZone/bollBand
  | 'pattern_engine'; // 本地形态识别：consecutiveLimitUp/maAlignment/resonance

export type FieldValueType = 'number' | 'enum' | 'boolean';

export interface FieldDefinition {
  /** 字段类别（用于前端分组展示） */
  category: ScreenerCategory;
  /** 数据来源（下游 service 据此决定从哪个 store 取数） */
  dataSource: ScreenerDataSource;
  /** 该字段允许使用的比较操作符 */
  ops: readonly FilterOp[];
  /** value 的类型，配合 ops 决定具体 Zod 校验 */
  valueType: FieldValueType;
  /** enum 字段的字面量白名单（仅 valueType === 'enum' 时存在） */
  enumValues?: readonly string[];
}

// ---------------------------------------------------------------------------
// 操作符 / 组合符
// ---------------------------------------------------------------------------

export const FILTER_OPS = ['>', '<', '>=', '<=', '=', 'between', 'in'] as const;
export type FilterOp = (typeof FILTER_OPS)[number];
export const FilterOpSchema = z.enum(FILTER_OPS);

export const SCREENER_COMBINATORS = ['AND', 'OR'] as const;
export type ScreenerCombinator = (typeof SCREENER_COMBINATORS)[number];
export const ScreenerCombinatorSchema = z.enum(SCREENER_COMBINATORS);

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

// ---------------------------------------------------------------------------
// 字段字典：12 个字段的元数据
// ---------------------------------------------------------------------------

export const FIELD_DEFINITIONS: Record<ScreenerField, FieldDefinition> = {
  // ----- fundamental：daily_basic -----
  pe: {
    category: 'fundamental',
    dataSource: 'daily_basic',
    ops: FILTER_OPS,
    valueType: 'number',
  },
  pb: {
    category: 'fundamental',
    dataSource: 'daily_basic',
    ops: FILTER_OPS,
    valueType: 'number',
  },
  marketCap: {
    category: 'fundamental',
    dataSource: 'daily_basic',
    ops: FILTER_OPS,
    valueType: 'number',
  },

  // ----- quote -----
  changePct: {
    category: 'quote',
    dataSource: 'daily_quote',
    ops: FILTER_OPS,
    valueType: 'number',
  },
  turnoverRate: {
    category: 'quote',
    dataSource: 'daily_basic',
    ops: FILTER_OPS,
    valueType: 'number',
  },
  volumeRatio: {
    category: 'quote',
    dataSource: 'daily_quote',
    ops: FILTER_OPS,
    valueType: 'number',
  },
  consecutiveLimitUp: {
    category: 'quote',
    dataSource: 'pattern_engine',
    ops: FILTER_OPS,
    valueType: 'number',
  },

  // ----- technical：仅 enum，op 必须是 = -----
  macdSignal: {
    category: 'technical',
    dataSource: 'indicator',
    ops: ['='],
    valueType: 'enum',
    enumValues: ['golden', 'death'],
  },
  kdjZone: {
    category: 'technical',
    dataSource: 'indicator',
    ops: ['='],
    valueType: 'enum',
    enumValues: ['oversold', 'overbought'],
  },
  bollBand: {
    category: 'technical',
    dataSource: 'indicator',
    ops: ['='],
    valueType: 'enum',
    enumValues: ['upper_break', 'lower_break'],
  },

  // ----- pattern -----
  maAlignment: {
    category: 'pattern',
    dataSource: 'pattern_engine',
    ops: ['='],
    valueType: 'enum',
    enumValues: ['bull', 'bear', 'mixed'],
  },
  resonance: {
    category: 'pattern',
    dataSource: 'pattern_engine',
    ops: ['='],
    valueType: 'boolean',
  },
};

// ---------------------------------------------------------------------------
// Condition：{ field, op, value }，value 类型必须匹配 field
// ---------------------------------------------------------------------------

export const ConditionSchema = z
  .object({
    field: z.string(),
    op: FilterOpSchema,
    value: z.unknown(),
  })
  .superRefine((data, ctx) => {
    const def = (FIELD_DEFINITIONS as Record<string, FieldDefinition | undefined>)[
      data.field
    ];
    if (!def) {
      ctx.addIssue({
        code: 'custom',
        path: ['field'],
        message: `Unknown field: "${data.field}". Allowed: ${SCREENER_FIELDS.join(', ')}`,
      });
      return;
    }

    if (!def.ops.includes(data.op as FilterOp)) {
      ctx.addIssue({
        code: 'custom',
        path: ['op'],
        message: `Op "${data.op}" is not allowed for field "${data.field}". Allowed: ${def.ops.join(', ')}`,
      });
    }

    const v = data.value;

    if (def.valueType === 'number') {
      if (data.op === 'between') {
        if (
          !Array.isArray(v) ||
          v.length !== 2 ||
          !v.every((x) => typeof x === 'number' && Number.isFinite(x))
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['value'],
            message: `Field "${data.field}" with op "between" requires [number, number]`,
          });
        }
      } else if (data.op === 'in') {
        if (
          !Array.isArray(v) ||
          v.length === 0 ||
          !v.every((x) => typeof x === 'number' && Number.isFinite(x))
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['value'],
            message: `Field "${data.field}" with op "in" requires number[]`,
          });
        }
      } else {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          ctx.addIssue({
            code: 'custom',
            path: ['value'],
            message: `Field "${data.field}" requires a finite number`,
          });
        }
      }
      return;
    }

    if (def.valueType === 'enum') {
      if (typeof v !== 'string' || !def.enumValues?.includes(v)) {
        ctx.addIssue({
          code: 'custom',
          path: ['value'],
          message: `Field "${data.field}" requires one of [${def.enumValues?.join(', ')}]`,
        });
      }
      return;
    }

    if (def.valueType === 'boolean') {
      if (typeof v !== 'boolean') {
        ctx.addIssue({
          code: 'custom',
          path: ['value'],
          message: `Field "${data.field}" requires a boolean`,
        });
      }
    }
  });

export type Condition = z.infer<typeof ConditionSchema>;

// ---------------------------------------------------------------------------
// ScreenerRequest
// ---------------------------------------------------------------------------

export const ScreenerSortSchema = z.object({
  field: z.enum(SCREENER_FIELDS),
  order: z.enum(SORT_ORDERS),
});
export type ScreenerSort = z.infer<typeof ScreenerSortSchema>;

export const ScreenerRequestSchema = z.object({
  combinator: ScreenerCombinatorSchema,
  groups: z.array(ConditionSchema).min(0).max(8),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  sort: ScreenerSortSchema,
});
export type ScreenerRequest = z.infer<typeof ScreenerRequestSchema>;

// ---------------------------------------------------------------------------
// ScreenerItem：响应行
// ---------------------------------------------------------------------------

export const ScreenerItemSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  price: z.number(),
  changePct: z.number(),
  turnoverRate: z.number().optional(),
  volumeRatio: z.number().optional(),
  pe: z.number().optional(),
  pb: z.number().optional(),
  marketCap: z.number().optional(),
  consecutiveLimitUp: z.number().optional(),
  macdSignal: z.string().optional(),
  kdjZone: z.string().optional(),
  bollBand: z.string().optional(),
  maAlignment: z.string().optional(),
  resonance: z.boolean().optional(),
});
export type ScreenerItem = z.infer<typeof ScreenerItemSchema>;

export interface ScreenerResponse {
  items: ScreenerItem[];
  total: number;
  page: number;
  pageSize: number;
  combinator: ScreenerCombinator;
}