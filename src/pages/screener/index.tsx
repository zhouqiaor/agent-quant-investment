/**
 * 条件选股器前端页
 *
 * 布局：
 * - 移动端：单列堆叠（条件在上，结果在下）
 * - 桌面 / 宽屏：左右 4:6 网格
 *
 * 防抖策略：
 * - useDeferredConditions: 仅在 conditions.length 变化时驱动 runQuery
 * - 单条件 value 修改不立即触发请求（避免每键击抖动）
 *
 * 预设：
 * - 通过 screener_presets localStorage 命名空间持久化
 * - 顶部 chip 区一键加载，右侧"删除预设"
 */
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  CATEGORY_LABELS,
  FIELD_DEFINITIONS,
  FIELD_LABELS,
  OP_LABELS,
  SCREENER_CATEGORIES,
  SCREENER_FIELDS,
  type Condition,
  type FieldValueType,
  type FilterOp,
  type ScreenerCategory,
  type ScreenerCombinator,
  type ScreenerField,
  type ScreenerItem,
  type ScreenerSort,
  getFieldsByCategory,
} from '@/lib/screener/types'
import { useScreenerStore } from '@/stores/screener'

// 注：PAGE_SIZE 由 store.pageSize 持有（默认 20），不再在页面内重复声明

/** 当前 SCREENER_CATEGORIES 列表（防止与 FIELD_DEFINITIONS 漂移） */
const ALL_CATEGORIES = SCREENER_CATEGORIES as readonly ScreenerCategory[]

/**
 * 顶层入口
 */
export default function ScreenerPage() {
  const {
    conditions,
    combinator,
    sort,
    page,
    pageSize,
    results,
    total,
    loading,
    error,
    presets,
    addCondition,
    removeCondition,
    updateCondition,
    setCombinator,
    setSort,
    setPage,
    runQuery,
    loadPreset,
    savePreset,
    deletePreset,
    reset,
  } = useScreenerStore()

  // 仅在 conditions.length 变化时驱动请求（防抖 + 长度门槛）
  const lastLenRef = useRef<number>(conditions.length)
  useEffect(() => {
    if (lastLenRef.current === conditions.length && conditions.length > 0) return
    lastLenRef.current = conditions.length
    if (conditions.length === 0) {
      // 重置时清空结果
      return
    }
    const t = setTimeout(() => {
      runQuery()
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions.length])

  // 排序 / 翻页 立即触发
  useEffect(() => {
    if (conditions.length === 0) return
    runQuery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort.field, sort.order, page])

  // 顶部 preset chip 选择
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const handleLoadPreset = (id: string) => {
    setActivePresetId(id)
    loadPreset(id)
  }

  // 保存预设
  const [presetModalOpen, setPresetModalOpen] = useState(false)
  const [presetNameInput, setPresetNameInput] = useState('')
  const handleOpenSavePreset = () => {
    setPresetNameInput('')
    setPresetModalOpen(true)
  }
  const handleConfirmSavePreset = () => {
    const saved = savePreset(presetNameInput.trim() || `预设-${new Date().toLocaleString('zh-CN')}`)
    if (saved) {
      setActivePresetId(saved.id)
      Taro.showToast({ title: '已保存', icon: 'success' })
    }
    setPresetModalOpen(false)
  }

  // 重置
  const handleReset = () => {
    Taro.showModal({
      title: '重置选股条件',
      content: '将清空当前所有条件、结果与预设选择',
      success: (res) => {
        if (res.confirm) {
          setActivePresetId(null)
          reset()
        }
      },
    })
  }

  return (
    <View className="flex flex-col h-full bg-slate-900">
      {/* 顶部：预设 chip 区 + 重置 */}
      <View className="flex flex-row items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-700 overflow-x-auto">
        <ScrollView scrollX className="flex-1" enhanced showScrollbar={false}>
          <View className="flex flex-row gap-2 pr-2">
            {presets.length === 0 ? (
              <Text className="block text-xs text-slate-500 self-center">暂无保存的预设</Text>
            ) : (
              presets.map((p) => (
                <View
                  key={p.id}
                  className={`flex flex-row items-center gap-1 px-3 py-1 rounded-full ${
                    activePresetId === p.id
                      ? 'bg-emerald-500'
                      : 'bg-slate-800 border border-slate-700'
                  }`}
                  onClick={() => handleLoadPreset(p.id)}
                  onLongPress={() => {
                    Taro.showActionSheet({
                      itemList: ['删除预设'],
                      success: (r) => {
                        if (r.tapIndex === 0) deletePreset(p.id)
                      },
                    })
                  }}
                >
                  <Text
                    className={`block text-xs whitespace-nowrap ${
                      activePresetId === p.id ? 'text-white' : 'text-slate-300'
                    }`}
                  >
                    {p.name}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
        <Button size="sm" className="h-9 px-3 bg-slate-700 text-slate-200" onClick={handleReset}>
          <Text className="text-xs">重置</Text>
        </Button>
      </View>

      {/* 主体：左 ConditionBuilder / 右 ScreenerResult */}
      <View className="flex-1 flex flex-col md:flex-row gap-3 px-4 py-3 overflow-hidden">
        <View className="md:w-2/5 w-full md:max-w-md">
          <ConditionBuilder
            conditions={conditions}
            combinator={combinator}
            total={total}
            loading={loading}
            onAdd={addCondition}
            onRemove={removeCondition}
            onUpdate={updateCondition}
            onCombinatorChange={setCombinator}
            onSavePreset={handleOpenSavePreset}
          />
        </View>
        <View className="flex-1 min-w-0">
          <ScreenerResult
            items={results}
            total={total}
            page={page}
            pageSize={pageSize}
            sort={sort}
            loading={loading}
            error={error}
            onSortChange={setSort}
            onPageChange={setPage}
          />
        </View>
      </View>

      {/* 保存预设弹层 */}
      {presetModalOpen && (
        <View
          className="fixed inset-0 bg-black bg-opacity-60 z-50 flex flex-col justify-end"
          onClick={() => setPresetModalOpen(false)}
        >
          <View
            className="bg-slate-800 rounded-t-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <Text className="block text-lg font-bold text-white mb-4">保存为预设</Text>
            <View className="bg-slate-900 rounded-xl px-4 py-3 mb-4">
              <Text className="block text-xs text-slate-400 mb-1">预设名称（留空将自动生成）</Text>
              <Input
                className="w-full bg-transparent text-white text-base font-medium outline-none"
                placeholder="如：低估值高换手"
                value={presetNameInput}
                onInput={(e: any) => setPresetNameInput(e.detail.value)}
              />
            </View>
            <Button
              className="w-full h-11 bg-emerald-500 text-white"
              onClick={handleConfirmSavePreset}
            >
              <Text className="text-sm font-medium">确认保存</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// ConditionBuilder
// ---------------------------------------------------------------------------

interface ConditionBuilderProps {
  conditions: Condition[]
  combinator: ScreenerCombinator
  total: number
  loading: boolean
  onAdd: (c?: Partial<Condition>) => void
  onRemove: (index: number) => void
  onUpdate: (index: number, patch: Partial<Condition>) => void
  onCombinatorChange: (c: ScreenerCombinator) => void
  onSavePreset: () => void
}

function ConditionBuilder(props: ConditionBuilderProps) {
  const {
    conditions,
    combinator,
    total,
    loading,
    onAdd,
    onRemove,
    onUpdate,
    onCombinatorChange,
    onSavePreset,
  } = props

  const [activeCategory, setActiveCategory] = useState<ScreenerCategory>('fundamental')
  const fieldsInTab = useMemo(() => getFieldsByCategory(activeCategory), [activeCategory])

  // 当前 Tab 命中数 = 所有条件命中数（仅展示用）
  // total 是后端聚合返回，不区分 category，因此此处只显示全局 total
  const hitText = conditions.length === 0 ? '请添加条件' : `命中 ${total} 只`

  return (
    <Card className="bg-slate-800 border-slate-700 rounded-2xl h-full">
      <CardContent className="p-4 flex flex-col h-full">
        {/* Header */}
        <View className="flex flex-row items-center justify-between mb-3">
          <Text className="block text-sm font-semibold text-white">条件构建器</Text>
          <View className="flex flex-row gap-1 bg-slate-900 rounded-lg p-1">
            {(['AND', 'OR'] as ScreenerCombinator[]).map((c) => (
              <View
                key={c}
                className={`px-3 py-1 rounded-md ${
                  combinator === c ? 'bg-emerald-500' : 'bg-transparent'
                }`}
                onClick={() => onCombinatorChange(c)}
              >
                <Text
                  className={`block text-xs ${
                    combinator === c ? 'text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  {c}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as ScreenerCategory)}>
          <TabsList className="flex flex-row bg-slate-900 rounded-lg p-1 mb-3 w-full">
            {ALL_CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat}
                value={cat}
                className={`flex-1 py-1 rounded-md text-xs ${
                  activeCategory === cat ? 'bg-slate-700 text-white' : 'text-slate-400'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab 内容：每 Tab 一个字段 chip 列表 + 添加按钮 */}
          {ALL_CATEGORIES.map((cat) => (
            <TabsContent key={cat} value={cat}>
              <View className="flex flex-row flex-wrap gap-1.5 mb-3">
                {getFieldsByCategory(cat).map((f) => (
                  <View
                    key={f}
                    className="px-2 py-1 rounded-md bg-slate-700 border border-slate-600"
                    onClick={() => onAdd({ field: f })}
                  >
                    <Text className="block text-xs text-slate-200 whitespace-nowrap">
                      {FIELD_LABELS[f]}
                    </Text>
                  </View>
                ))}
              </View>
            </TabsContent>
          ))}
        </Tabs>

        {/* 条件列表 */}
        <ScrollView scrollY className="flex-1 smooth-scroll min-h-0">
          {conditions.length === 0 ? (
            <View className="flex flex-col items-center justify-center py-8">
              <Text className="block text-xs text-slate-500">
                点击上方字段即可添加条件（{fieldsInTab.length} 个字段可选）
              </Text>
            </View>
          ) : (
            <View className="flex flex-col gap-2 pb-2">
              {conditions.map((c, i) => (
                <ConditionRow
                  key={i}
                  index={i}
                  condition={c}
                  onUpdate={(patch) => onUpdate(i, patch)}
                  onRemove={() => onRemove(i)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View className="border-t border-slate-700 pt-3 mt-2 flex flex-col gap-2">
          <View className="flex flex-row items-center justify-between">
            <Text className="block text-xs text-slate-400">
              {loading ? '查询中...' : hitText}
            </Text>
            <View className="flex flex-row gap-2">
              <Button
                size="sm"
                className="h-8 px-3 bg-slate-700 text-slate-200"
                onClick={onSavePreset}
                disabled={conditions.length === 0}
              >
                <Text className="text-xs">保存为预设</Text>
              </Button>
            </View>
          </View>
          <Button
            className="w-full h-10 bg-emerald-500 text-white"
            onClick={() => onAdd()}
            disabled={activeCategory == null}
          >
            <Text className="text-sm font-medium">+ 添加条件</Text>
          </Button>
        </View>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// ConditionRow
// ---------------------------------------------------------------------------

interface ConditionRowProps {
  index: number
  condition: Condition
  onUpdate: (patch: Partial<Condition>) => void
  onRemove: () => void
}

function ConditionRow({ condition, onUpdate, onRemove }: ConditionRowProps) {
  const def = FIELD_DEFINITIONS[condition.field]
  const valueType: FieldValueType = def.valueType

  const handleFieldChange = (field: ScreenerField) => {
    const newDef = FIELD_DEFINITIONS[field]
    // 切换字段时，若旧 op 不在新的 ops 列表中，重置为第一个
    const newOp: FilterOp = newDef.ops.includes(condition.op) ? condition.op : newDef.ops[0]
    // 重置 value 为字段默认值
    let newValue: Condition['value']
    if (newDef.valueType === 'number') newValue = 0
    else if (newDef.valueType === 'boolean') newValue = false
    else newValue = newDef.enumValues?.[0] ?? ''
    onUpdate({ field, op: newOp, value: newValue })
  }

  return (
    <View className="bg-slate-900 rounded-lg p-3 border border-slate-700">
      <View className="flex flex-row items-center justify-between mb-2">
        <Text className="block text-xs text-slate-400">条件 #{condition.field}</Text>
        <View
          className="w-6 h-6 rounded-full bg-red-500 bg-opacity-20 flex items-center justify-center"
          onClick={onRemove}
        >
          <Text className="block text-xs text-red-400 leading-none">×</Text>
        </View>
      </View>

      <View className="flex flex-col gap-2">
        {/* 字段选择 */}
        <View className="flex flex-row items-center gap-2">
          <Text className="block text-xs text-slate-400 w-12">字段</Text>
          <View className="flex-1">
            <PickerField
              value={condition.field}
              options={SCREENER_FIELDS}
              onChange={(v) => handleFieldChange(v as ScreenerField)}
              formatLabel={(v) => FIELD_LABELS[v as ScreenerField]}
            />
          </View>
        </View>

        {/* op 选择 */}
        <View className="flex flex-row items-center gap-2">
          <Text className="block text-xs text-slate-400 w-12">比较</Text>
          <View className="flex-1">
            <PickerField
              value={condition.op}
              options={def.ops as readonly string[]}
              onChange={(v) => onUpdate({ op: v as FilterOp })}
              formatLabel={(v) => OP_LABELS[v as FilterOp]}
            />
          </View>
        </View>

        {/* value 输入 */}
        <View className="flex flex-row items-center gap-2">
          <Text className="block text-xs text-slate-400 w-12">值</Text>
          <View className="flex-1">
            <ValueInput valueType={valueType} condition={condition} def={def} onUpdate={onUpdate} />
          </View>
        </View>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// ValueInput: 根据 valueType 渲染不同控件
// ---------------------------------------------------------------------------

interface ValueInputProps {
  valueType: FieldValueType
  condition: Condition
  def: typeof FIELD_DEFINITIONS[ScreenerField]
  onUpdate: (patch: Partial<Condition>) => void
}

function ValueInput({ valueType, condition, def, onUpdate }: ValueInputProps) {
  if (valueType === 'boolean') {
    const v = condition.value === true || condition.value === 'true'
    return (
      <View className="flex flex-row gap-2">
        {(['true', 'false'] as const).map((opt) => (
          <View
            key={opt}
            className={`flex-1 py-2 rounded-md text-center ${
              (v && opt === 'true') || (!v && opt === 'false')
                ? 'bg-emerald-500'
                : 'bg-slate-800 border border-slate-700'
            }`}
            onClick={() => onUpdate({ value: opt === 'true' })}
          >
            <Text
              className={`block text-xs ${
                (v && opt === 'true') || (!v && opt === 'false') ? 'text-white' : 'text-slate-400'
              }`}
            >
              {def.enumLabels?.[opt] ?? opt}
            </Text>
          </View>
        ))}
      </View>
    )
  }

  if (valueType === 'enum') {
    const opts = def.enumValues ?? []
    return (
      <View className="flex flex-row flex-wrap gap-1">
        {opts.map((opt) => {
          const selected = condition.value === opt
          return (
            <View
              key={opt}
              className={`px-3 py-1 rounded-md ${
                selected ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-700'
              }`}
              onClick={() => onUpdate({ value: opt })}
            >
              <Text
                className={`block text-xs ${
                  selected ? 'text-white' : 'text-slate-400'
                } whitespace-nowrap`}
              >
                {def.enumLabels?.[opt] ?? opt}
              </Text>
            </View>
          )
        })}
      </View>
    )
  }

  // number: 支持 single / between / in
  if (condition.op === 'between') {
    const arr = Array.isArray(condition.value) ? (condition.value as number[]) : [0, 0]
    return (
      <View className="flex flex-row items-center gap-1.5">
        <Input
          type="number"
          className="flex-1 h-8 text-xs bg-slate-800 border-slate-700 text-white"
          value={String(arr[0] ?? '')}
          onInput={(e: any) => {
            const v = Number(e.detail.value)
            onUpdate({ value: [Number.isFinite(v) ? v : 0, arr[1] ?? 0] })
          }}
        />
        <Text className="block text-xs text-slate-500">~</Text>
        <Input
          type="number"
          className="flex-1 h-8 text-xs bg-slate-800 border-slate-700 text-white"
          value={String(arr[1] ?? '')}
          onInput={(e: any) => {
            const v = Number(e.detail.value)
            onUpdate({ value: [arr[0] ?? 0, Number.isFinite(v) ? v : 0] })
          }}
        />
      </View>
    )
  }

  if (condition.op === 'in') {
    const arr = Array.isArray(condition.value) ? (condition.value as number[]) : []
    const text = arr.join(',')
    return (
      <Input
        className="h-8 text-xs bg-slate-800 border-slate-700 text-white"
        value={text}
        placeholder="逗号分隔，如 5,10,15"
        onInput={(e: any) => {
          const parts = e.detail.value
            .split(',')
            .map((s: string) => Number(s.trim()))
            .filter((n: number) => Number.isFinite(n))
          onUpdate({ value: parts })
        }}
      />
    )
  }

  // 单值 number
  const num = typeof condition.value === 'number' ? condition.value : Number(condition.value) || 0
  return (
    <Input
      type="number"
      className="h-8 text-xs bg-slate-800 border-slate-700 text-white"
      value={String(num)}
      onInput={(e: any) => {
        const v = Number(e.detail.value)
        onUpdate({ value: Number.isFinite(v) ? v : 0 })
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// PickerField: 复用 chip-row 风格的选择器（避免引入 picker 跨端差异）
// ---------------------------------------------------------------------------

interface PickerFieldProps {
  value: string
  options: readonly string[]
  onChange: (v: string) => void
  formatLabel: (v: string) => string
}

function PickerField({ value, options, onChange, formatLabel }: PickerFieldProps) {
  return (
    <ScrollView scrollX enhanced showScrollbar={false} className="w-full">
      <View className="flex flex-row gap-1 pr-2">
        {options.map((opt) => {
          const selected = opt === value
          return (
            <View
              key={opt}
              className={`px-3 py-1 rounded-md whitespace-nowrap ${
                selected ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-700'
              }`}
              onClick={() => onChange(opt)}
            >
              <Text
                className={`block text-xs ${selected ? 'text-white' : 'text-slate-300'}`}
              >
                {formatLabel(opt)}
              </Text>
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}

// ---------------------------------------------------------------------------
// ScreenerResult
// ---------------------------------------------------------------------------

interface ScreenerResultProps {
  items: ScreenerItem[]
  total: number
  page: number
  pageSize: number
  sort: ScreenerSort
  loading: boolean
  error: string | null
  onSortChange: (s: ScreenerSort) => void
  onPageChange: (p: number) => void
}

function ScreenerResult(props: ScreenerResultProps) {
  const { items, total, page, pageSize, sort, loading, error, onSortChange, onPageChange } = props
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleSort = (field: ScreenerSort['field']) => {
    if (sort.field === field) {
      onSortChange({ field, order: sort.order === 'asc' ? 'desc' : 'asc' })
    } else {
      onSortChange({ field, order: 'desc' })
    }
  }

  const sortArrow = (field: ScreenerSort['field']) => {
    if (sort.field !== field) return ''
    return sort.order === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <Card className="bg-slate-800 border-slate-700 rounded-2xl h-full">
      <CardContent className="p-4 flex flex-col h-full">
        <View className="flex flex-row items-center justify-between mb-3">
          <Text className="block text-sm font-semibold text-white">选股结果</Text>
          <Badge className="bg-slate-700 text-slate-300 border-slate-600">
            共 {total} 只
          </Badge>
        </View>

        {error && (
          <View className="bg-red-500 bg-opacity-10 border border-red-500 rounded-lg p-3 mb-3">
            <Text className="block text-xs text-red-400">{error}</Text>
          </View>
        )}

        <ScrollView scrollY className="flex-1 smooth-scroll min-h-0">
          {loading && items.length === 0 ? (
            <View className="flex flex-col items-center justify-center py-12">
              <Text className="block text-xs text-slate-500">查询中...</Text>
            </View>
          ) : items.length === 0 ? (
            <View className="flex flex-col items-center justify-center py-12">
              <Text className="block text-xs text-slate-500">暂无结果，请先添加条件</Text>
            </View>
          ) : (
            <View className="flex flex-col gap-2">
              {/* 表头（移动端单行 6 列；desktop 7 列含共振） */}
              <View className="flex flex-row bg-slate-900 rounded-lg py-2 px-2 text-xs text-slate-400">
                <View className="w-16 shrink-0" onClick={() => handleSort('changePct')}>
                  <Text className="block text-xs">代码</Text>
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="block text-xs">名称</Text>
                </View>
                <View className="w-16 text-right">
                  <Text className="block text-xs">现价</Text>
                </View>
                <View className="w-16 text-right" onClick={() => handleSort('changePct')}>
                  <Text className="block text-xs">涨跌幅{sortArrow('changePct')}</Text>
                </View>
                <View className="w-14 text-right hidden md:block" onClick={() => handleSort('turnoverRate')}>
                  <Text className="block text-xs">换手率{sortArrow('turnoverRate')}</Text>
                </View>
                <View className="w-14 text-right hidden md:block" onClick={() => handleSort('pe')}>
                  <Text className="block text-xs">PE{sortArrow('pe')}</Text>
                </View>
                <View className="w-14 text-center hidden md:block">
                  <Text className="block text-xs">共振</Text>
                </View>
                <View className="w-20 text-right shrink-0">
                  <Text className="block text-xs">操作</Text>
                </View>
              </View>

              {/* 行 */}
              {items.map((it) => (
                <ResultRow key={it.symbol} item={it} />
              ))}
            </View>
          )}
        </ScrollView>

        {/* 分页 */}
        {total > 0 && (
          <View className="border-t border-slate-700 pt-3 mt-2 flex flex-row items-center justify-between">
            <Text className="block text-xs text-slate-400">
              第 {page} / {totalPages} 页 · 每页 {pageSize}
            </Text>
            <View className="flex flex-row gap-2">
              <Button
                size="sm"
                className="h-8 px-3 bg-slate-700 text-slate-200"
                disabled={page <= 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
              >
                <Text className="text-xs">上一页</Text>
              </Button>
              <Button
                size="sm"
                className="h-8 px-3 bg-slate-700 text-slate-200"
                disabled={page >= totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              >
                <Text className="text-xs">下一页</Text>
              </Button>
            </View>
          </View>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// ResultRow
// ---------------------------------------------------------------------------

interface ResultRowProps {
  item: ScreenerItem
}

function ResultRow({ item }: ResultRowProps) {
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  const handleAddWatch = async () => {
    if (adding || added) return
    setAdding(true)
    try {
      await Network.request({
        url: '/api/stock/watchlist',
        method: 'POST',
        data: { symbol: item.symbol, name: item.name, enabled: true },
      })
      setAdded(true)
      Taro.showToast({ title: '已加入自选', icon: 'success' })
    } catch (e) {
      console.error('[screener] add watchlist error', e)
      Taro.showToast({ title: '加入失败', icon: 'none' })
    } finally {
      setAdding(false)
    }
  }

  const handleDetail = () => {
    Taro.navigateTo({
      url: `/pages/position/index?symbol=${encodeURIComponent(item.symbol)}&name=${encodeURIComponent(item.name)}`,
    })
  }

  const isUp = item.changePct > 0
  const isDown = item.changePct < 0
  const color = isUp ? '#22c55e' : isDown ? '#ef4444' : '#94a3b8'
  const sign = isUp ? '+' : ''

  return (
    <View className="flex flex-row items-center bg-slate-900 rounded-lg py-2 px-2 border border-slate-700">
      <View className="w-16 shrink-0">
        <Text className="block text-xs text-slate-200 tabular-nums truncate">{item.symbol}</Text>
      </View>
      <View className="flex-1 min-w-0">
        <Text className="block text-xs text-white truncate">{item.name}</Text>
      </View>
      <View className="w-16 text-right">
        <Text className="block text-xs text-white tabular-nums">
          {item.price.toFixed(2)}
        </Text>
      </View>
      <View className="w-16 text-right">
        <Text className="block text-xs tabular-nums" style={{ color }}>
          {sign}
          {item.changePct.toFixed(2)}%
        </Text>
      </View>
      <View className="w-14 text-right hidden md:block">
        <Text className="block text-xs text-slate-300 tabular-nums">
          {item.turnoverRate != null ? item.turnoverRate.toFixed(2) + '%' : '--'}
        </Text>
      </View>
      <View className="w-14 text-right hidden md:block">
        <Text className="block text-xs text-slate-300 tabular-nums">
          {item.pe != null ? item.pe.toFixed(2) : '--'}
        </Text>
      </View>
      <View className="w-14 text-center hidden md:block">
        {item.resonance ? (
          <Badge className="bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border">
            <Text className="block text-[10px]">是</Text>
          </Badge>
        ) : (
          <Text className="block text-xs text-slate-500">--</Text>
        )}
      </View>
      <View className="w-20 text-right shrink-0 flex flex-row gap-1 justify-end">
        <Button
          size="sm"
          className={`h-7 px-2 ${
            added ? 'bg-slate-700 text-slate-500' : 'bg-emerald-500 bg-opacity-20 text-emerald-400 border border-emerald-500'
          }`}
          onClick={handleAddWatch}
          disabled={adding || added}
        >
          <Text className="text-[10px]">{added ? '已加入' : '+ 自选'}</Text>
        </Button>
        <Button
          size="sm"
          className="h-7 px-2 bg-slate-700 text-slate-200"
          onClick={handleDetail}
        >
          <Text className="text-[10px]">详情</Text>
        </Button>
      </View>
    </View>
  )
}
