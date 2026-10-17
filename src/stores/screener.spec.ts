/**
 * screener store 单测
 *
 * 覆盖：
 * - addCondition / removeCondition / updateCondition reducer 行为
 * - setCombinator / setSort / setPage 影响 page
 * - savePreset / loadPreset / deletePreset 通过 localStorage 持久化
 * - reset 清空条件但保留 presets
 *
 * 通过 ambient describe/it/expect 声明保持 pnpm tsc 通过
 * （项目当前无前端测试运行时；详见 src/lib/use-animated-number.spec.ts 注释）
 *
 * 注意：jest.mock / beforeEach 仍以 ambient 形式声明，避免引入 jest 类型。
 * 网络副作用在本 spec 中不验证（runQuery 仅验证空条件分支）。
 */

import { PRESETS_STORAGE_KEY } from '@/lib/screener/types'
import { useScreenerStore } from './screener'

// 注入 localStorage shim（jsdom 的 localStorage 为原型只读访问器，需 defineProperty）
const _lsMap = new Map<string, string>()
const _lsShim = Object.assign(_lsMap, {
  getItem: (k: string) => (_lsMap.has(k) ? _lsMap.get(k)! : null),
  setItem: (k: string, v: string) => {
    _lsMap.set(k, v)
  },
  removeItem: (k: string) => {
    _lsMap.delete(k)
  },
  clear: () => {
    Map.prototype.clear.call(_lsMap)
  },
})
Object.defineProperty(globalThis, 'localStorage', {
  value: _lsShim,
  configurable: true,
  writable: true,
})

// mock 网络层
jest.mock('@/network', () => ({
  Network: {
    request: () => ({
      data: { code: 200, data: { items: [], total: 0, page: 1, pageSize: 20, combinator: 'AND' } },
    }),
  },
}))

beforeEach(() => {
  _lsMap.clear()
  useScreenerStore.getState().reset()
  useScreenerStore.setState({ presets: [] })
})

afterEach(() => {
  _lsMap.clear()
})

describe('useScreenerStore reducer', () => {
  it('addCondition 追加条件，并把 page 重置为 1', () => {
    useScreenerStore.setState({ page: 3 })
    useScreenerStore.getState().addCondition({ field: 'pe', op: '<', value: 20 })
    const s = useScreenerStore.getState()
    expect(s.conditions.length).toBe(1)
    expect(s.conditions[0].field).toBe('pe')
    expect(s.page).toBe(1)
  })

  it('addCondition 不传参时使用默认值 pe / < / 0', () => {
    useScreenerStore.getState().addCondition()
    const c = useScreenerStore.getState().conditions[0]
    expect(c.field).toBe('pe')
    expect(c.op).toBe('<')
    expect(c.value).toBe(0)
  })

  it('removeCondition 删除指定 index 并重置 page', () => {
    useScreenerStore.setState({
      conditions: [
        { field: 'pe', op: '<', value: 10 },
        { field: 'pb', op: '<', value: 2 },
        { field: 'turnoverRate', op: '>', value: 5 },
      ],
      page: 5,
    })
    useScreenerStore.getState().removeCondition(1)
    const s = useScreenerStore.getState()
    expect(s.conditions.length).toBe(2)
    expect(s.conditions[0].field).toBe('pe')
    expect(s.conditions[1].field).toBe('turnoverRate')
    expect(s.page).toBe(1)
  })

  it('updateCondition 部分更新，并把 page 重置为 1', () => {
    useScreenerStore.setState({
      conditions: [{ field: 'pe', op: '<', value: 10 }],
      page: 4,
    })
    useScreenerStore.getState().updateCondition(0, { value: 30 })
    const s = useScreenerStore.getState()
    expect(s.conditions[0].value).toBe(30)
    expect(s.conditions[0].field).toBe('pe')
    expect(s.page).toBe(1)
  })

  it('setCombinator / setSort / setPage 行为正确', () => {
    useScreenerStore.getState().setCombinator('OR')
    expect(useScreenerStore.getState().combinator).toBe('OR')

    useScreenerStore.getState().setSort({ field: 'pe', order: 'asc' })
    expect(useScreenerStore.getState().sort.field).toBe('pe')
    expect(useScreenerStore.getState().page).toBe(1)

    useScreenerStore.setState({ page: 1 })
    useScreenerStore.getState().setPage(5)
    expect(useScreenerStore.getState().page).toBe(5)
  })

  it('reset 清空 conditions / results / total，但保留 presets', () => {
    useScreenerStore.setState({
      conditions: [{ field: 'pe', op: '<', value: 10 }],
      results: [{ symbol: '000001', name: 'X', price: 1, changePct: 1 }],
      total: 1,
      presets: [
        {
          id: 'p1',
          name: 'test',
          combinator: 'AND',
          conditions: [],
          sort: { field: 'changePct', order: 'desc' },
          createdAt: '',
        },
      ],
    })
    useScreenerStore.getState().reset()
    const s = useScreenerStore.getState()
    expect(s.conditions.length).toBe(0)
    expect(s.results.length).toBe(0)
    expect(s.total).toBe(0)
    expect(s.presets.length).toBe(1)
  })
})

describe('useScreenerStore presets 持久化', () => {
  it('savePreset 写入 localStorage（命名空间 screener_presets）', () => {
    useScreenerStore.setState({
      conditions: [{ field: 'pe', op: '<', value: 10 }],
      combinator: 'AND',
      sort: { field: 'changePct', order: 'desc' },
    })
    const saved = useScreenerStore.getState().savePreset('低估值')
    expect(saved).toBeTruthy()
    if (!saved) return
    expect(saved.name).toBe('低估值')

    const raw = _lsMap.get(PRESETS_STORAGE_KEY)
    expect(raw).toBeTruthy()
    if (!raw) return
    const blob = JSON.parse(raw)
    expect(blob.version).toBe(1)
    expect(blob.presets.length).toBe(1)
    expect(blob.presets[0].name).toBe('低估值')
  })

  it('savePreset 空名返回 null', () => {
    const r = useScreenerStore.getState().savePreset('  ')
    expect(r).toBeFalsy()
    expect(useScreenerStore.getState().presets.length).toBe(0)
  })

  it('loadPreset 命中时回填 conditions/combinator/sort', () => {
    // 先预置一个带条件的状态再保存，preset 内才有 conditions 可回填
    // （sort 用 store 初始默认值 changePct/desc）
    useScreenerStore.setState({
      conditions: [{ field: 'pe', op: '<', value: 10 }],
      combinator: 'AND',
    })
    useScreenerStore.getState().savePreset('A')
    const id = useScreenerStore.getState().presets[0].id
    // 修改 store 状态
    useScreenerStore.setState({
      conditions: [],
      combinator: 'OR',
      sort: { field: 'pe', order: 'asc' },
    })
    useScreenerStore.getState().loadPreset(id)
    const s = useScreenerStore.getState()
    expect(s.conditions.length).toBeTruthy()
    expect(s.combinator).toBe('AND')
    expect(s.sort.field).toBe('changePct')
  })

  it('loadPreset 未命中时不动 store', () => {
    useScreenerStore.setState({ combinator: 'OR' })
    useScreenerStore.getState().loadPreset('not-exist')
    expect(useScreenerStore.getState().combinator).toBe('OR')
  })

  it('deletePreset 同步刷新内存与 localStorage', () => {
    useScreenerStore.getState().savePreset('A')
    useScreenerStore.getState().savePreset('B')
    const a = useScreenerStore.getState().presets.find((p) => p.name === 'A')
    expect(a).toBeDefined()
    if (!a) return
    useScreenerStore.getState().deletePreset(a.id)
    const s = useScreenerStore.getState()
    expect(s.presets.length).toBe(1)
    expect(s.presets[0].name).toBe('B')
    const raw = _lsMap.get(PRESETS_STORAGE_KEY)
    expect(raw).toBeTruthy()
    if (!raw) return
    const blob = JSON.parse(raw)
    expect(blob.presets.length).toBe(1)
  })

  it('脏数据（缺 version）写入 localStorage 也不会破坏 store', () => {
    _lsMap.set(PRESETS_STORAGE_KEY, JSON.stringify({ foo: 1 }))
    // store 自身在初始化时只读取一次；这里验证 savePreset 后再写入仍带 version
    useScreenerStore.getState().savePreset('Z')
    const raw = _lsMap.get(PRESETS_STORAGE_KEY)
    expect(raw).toBeTruthy()
    if (!raw) return
    const blob = JSON.parse(raw)
    expect(blob.version).toBe(1)
  })
})

describe('useScreenerStore runQuery 边界', () => {
  it('conditions 为空时，runQuery 不发请求且 results 清空', async () => {
    useScreenerStore.setState({
      conditions: [],
      results: [{ symbol: '000001', name: 'X', price: 1, changePct: 1 }],
      total: 1,
    })
    await useScreenerStore.getState().runQuery()
    const s = useScreenerStore.getState()
    expect(s.results.length).toBe(0)
    expect(s.total).toBe(0)
  })
})
