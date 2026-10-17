import {
  ScreenerRequestSchema,
  ScreenerItemSchema,
  FIELD_DEFINITIONS,
  ScreenerField,
  FilterOp,
  ScreenerCombinator,
} from './schema';

describe('Screener Schema (TDD)', () => {
  describe('FIELD_DEFINITIONS 字段字典自检', () => {
    it('导出 12 个字段字典', () => {
      expect(Object.keys(FIELD_DEFINITIONS)).toHaveLength(12);
    });

    it('每个字段都定义了 category / dataSource / ops / valueType', () => {
      for (const [field, def] of Object.entries(FIELD_DEFINITIONS)) {
        expect(def.category).toBeTruthy();
        expect(def.dataSource).toBeTruthy();
        expect(Array.isArray(def.ops)).toBe(true);
        expect(def.ops.length).toBeGreaterThan(0);
        expect(def.valueType).toBeTruthy();
      }
    });

    it('字段集合与 ScreenerField enum 严格匹配', () => {
      const defs = Object.keys(FIELD_DEFINITIONS).sort();
      const enumFields = [
        'pe',
        'pb',
        'marketCap',
        'changePct',
        'turnoverRate',
        'volumeRatio',
        'consecutiveLimitUp',
        'macdSignal',
        'kdjZone',
        'bollBand',
        'maAlignment',
        'resonance',
      ].sort();
      expect(defs).toEqual(enumFields);
    });

    it('fundamental 类别字段值类型都是 number', () => {
      const fundamentals = ['pe', 'pb', 'marketCap'] as const;
      for (const f of fundamentals) {
        expect(FIELD_DEFINITIONS[f].category).toBe('fundamental');
        expect(FIELD_DEFINITIONS[f].valueType).toBe('number');
      }
    });

    it('enum 字段允许的 op 只有 =', () => {
      const enumFields = ['macdSignal', 'kdjZone', 'bollBand', 'maAlignment'] as const;
      for (const f of enumFields) {
        expect(FIELD_DEFINITIONS[f].valueType).toBe('enum');
        expect(FIELD_DEFINITIONS[f].ops).toEqual(['=']);
      }
    });

    it('resonance 字段 valueType 为 boolean 且 op 只有 =', () => {
      expect(FIELD_DEFINITIONS.resonance.valueType).toBe('boolean');
      expect(FIELD_DEFINITIONS.resonance.ops).toEqual(['=']);
    });
  });

  describe('ScreenerRequestSchema 合法入参', () => {
    it('最小请求（无 groups）通过', () => {
      const req = {
        combinator: 'AND',
        groups: [],
        page: 1,
        pageSize: 20,
        sort: { field: 'changePct', order: 'desc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).not.toThrow();
    });

    it('完整数值条件请求通过', () => {
      const req = {
        combinator: 'AND',
        groups: [
          { field: 'pe', op: '<', value: 30 },
          { field: 'pb', op: 'between', value: [1, 5] },
          { field: 'changePct', op: '>=', value: 2 },
        ],
        page: 1,
        pageSize: 50,
        sort: { field: 'changePct', order: 'desc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).not.toThrow();
    });

    it('enum 条件 + 布尔条件请求通过', () => {
      const req = {
        combinator: 'OR',
        groups: [
          { field: 'macdSignal', op: '=', value: 'golden' },
          { field: 'kdjZone', op: '=', value: 'oversold' },
          { field: 'resonance', op: '=', value: true },
        ],
        page: 1,
        pageSize: 20,
        sort: { field: 'changePct', order: 'desc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).not.toThrow();
    });

    it('groups 满 8 条仍合法', () => {
      const groups = Array.from({ length: 8 }, (_, i) => ({
        field: 'pe',
        op: '<',
        value: 10 + i,
      }));
      const req = {
        combinator: 'AND',
        groups,
        page: 1,
        pageSize: 20,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).not.toThrow();
    });
  });

  describe('ScreenerRequestSchema 拒绝非法入参', () => {
    it('groups 超过 8 条拒绝', () => {
      const groups = Array.from({ length: 9 }, () => ({
        field: 'pe',
        op: '<',
        value: 30,
      }));
      const req = {
        combinator: 'AND',
        groups,
        page: 1,
        pageSize: 20,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('pageSize > 100 拒绝', () => {
      const req = {
        combinator: 'AND',
        groups: [],
        page: 1,
        pageSize: 500,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('page < 1 拒绝', () => {
      const req = {
        combinator: 'AND',
        groups: [],
        page: 0,
        pageSize: 20,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('combinator 不在白名单内拒绝', () => {
      const req = {
        combinator: 'XOR',
        groups: [],
        page: 1,
        pageSize: 20,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('不存在的 field 拒绝', () => {
      const req = {
        combinator: 'AND',
        groups: [{ field: 'notAField', op: '=', value: 1 }],
        page: 1,
        pageSize: 20,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('op 不在白名单内拒绝', () => {
      const req = {
        combinator: 'AND',
        groups: [{ field: 'pe', op: '~=' as FilterOp, value: 1 }],
        page: 1,
        pageSize: 20,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('between 必须 value 是二元数组 (number)', () => {
      const req = {
        combinator: 'AND',
        groups: [{ field: 'pb', op: 'between', value: [1] }],
        page: 1,
        pageSize: 20,
        sort: { field: 'pb', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('between 的二元数组元素必须是 number', () => {
      const req = {
        combinator: 'AND',
        groups: [{ field: 'pb', op: 'between', value: [1, 'x'] }],
        page: 1,
        pageSize: 20,
        sort: { field: 'pb', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('in 的 value 必须是数组', () => {
      const req = {
        combinator: 'AND',
        groups: [{ field: 'pe', op: 'in', value: 5 }],
        page: 1,
        pageSize: 20,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('in 的数组元素必须是 number', () => {
      const req = {
        combinator: 'AND',
        groups: [{ field: 'pe', op: 'in', value: [1, 'x'] }],
        page: 1,
        pageSize: 20,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('number 字段 value 传字符串拒绝', () => {
      const req = {
        combinator: 'AND',
        groups: [{ field: 'pe', op: '<', value: '30' }],
        page: 1,
        pageSize: 20,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('enum 字段 op 必须 =', () => {
      const req = {
        combinator: 'AND',
        groups: [{ field: 'macdSignal', op: '<', value: 'golden' }],
        page: 1,
        pageSize: 20,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('enum 字段 value 必须是 enum 字面量', () => {
      const req = {
        combinator: 'AND',
        groups: [{ field: 'macdSignal', op: '=', value: 'mystery' }],
        page: 1,
        pageSize: 20,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('resonance 字段 value 必须是 boolean', () => {
      const req = {
        combinator: 'AND',
        groups: [{ field: 'resonance', op: '=', value: 'yes' }],
        page: 1,
        pageSize: 20,
        sort: { field: 'pe', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });

    it('sort.field 也必须在字段字典内', () => {
      const req = {
        combinator: 'AND',
        groups: [],
        page: 1,
        pageSize: 20,
        sort: { field: 'ghost', order: 'asc' },
      };
      expect(() => ScreenerRequestSchema.parse(req)).toThrow();
    });
  });

  describe('ScreenerItemSchema 响应行', () => {
    it('完整 ScreenerItem 通过', () => {
      const item = {
        symbol: '600519',
        name: '贵州茅台',
        price: 1302.8,
        changePct: 2.5,
        turnoverRate: 1.2,
        pe: 28.5,
        marketCap: 1.6e12,
      };
      expect(() => ScreenerItemSchema.parse(item)).not.toThrow();
    });

    it('缺少必填 symbol/name 拒绝', () => {
      expect(() => ScreenerItemSchema.parse({ name: 'x', price: 1, changePct: 0 })).toThrow();
      expect(() => ScreenerItemSchema.parse({ symbol: '600519', price: 1, changePct: 0 })).toThrow();
    });
  });

  describe('类型导出', () => {
    it('ScreenerField 是 12 个字段的字面量联合', () => {
      // 编译期类型检查；运行时通过类型断言验证数量
      const fields: ScreenerField[] = [
        'pe',
        'pb',
        'marketCap',
        'changePct',
        'turnoverRate',
        'volumeRatio',
        'consecutiveLimitUp',
        'macdSignal',
        'kdjZone',
        'bollBand',
        'maAlignment',
        'resonance',
      ];
      expect(fields).toHaveLength(12);
    });

    it('FilterOp / ScreenerCombinator 是合法字面量', () => {
      const ops: FilterOp[] = ['>', '<', '>=', '<=', '=', 'between', 'in'];
      const combinators: ScreenerCombinator[] = ['AND', 'OR'];
      expect(ops).toHaveLength(7);
      expect(combinators).toHaveLength(2);
    });
  });
});