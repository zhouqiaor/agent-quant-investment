/**
 * 指标参数设置页
 *
 * 4 个折叠面板（MA / MACD / BOLL / KDJ），底部"保存"按钮
 * - 数据持久化：通过 indicator-settings store 写到 localStorage `indicator_settings`
 * - 校验失败由 store 静默拒绝；页面只显示当前生效的 config
 *
 * 设计原则：
 * - MA：编辑周期数组（添加 / 删除 chip）
 * - MACD / BOLL / KDJ：3 / 2 / 3 个数字输入框
 * - 校验范围：1..200（与后端 normalizeIndicatorConfig 对齐）
 */
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { TrendingUp, Plus, Trash2, RotateCcw, Save, Settings as SettingsIcon } from 'lucide-react-taro'
import {
  DEFAULT_INDICATOR_CONFIG,
  INDICATOR_PARAM_MAX,
} from '@/lib/indicators/types'
import { useIndicatorSettingsStore } from '@/stores/indicator-settings'

const PARAM_MAX = INDICATOR_PARAM_MAX

function IndicatorSettingsPage() {
  const config = useIndicatorSettingsStore((s) => s.config)
  const setMaPeriods = useIndicatorSettingsStore((s) => s.setMaPeriods)
  const setMacdConfig = useIndicatorSettingsStore((s) => s.setMacdConfig)
  const setBollConfig = useIndicatorSettingsStore((s) => s.setBollConfig)
  const setKdjConfig = useIndicatorSettingsStore((s) => s.setKdjConfig)
  const reset = useIndicatorSettingsStore((s) => s.reset)

  // 本地表单态（保存时才生效）
  const [maInput, setMaInput] = useState('')
  const [macdFast, setMacdFast] = useState(String(config.macd.fast))
  const [macdSlow, setMacdSlow] = useState(String(config.macd.slow))
  const [macdSignal, setMacdSignal] = useState(String(config.macd.signal))
  const [bollPeriod, setBollPeriod] = useState(String(config.boll.period))
  const [bollK, setBollK] = useState(String(config.boll.k))
  const [kdjN, setKdjN] = useState(String(config.kdj.n))
  const [kdjM1, setKdjM1] = useState(String(config.kdj.m1))
  const [kdjM2, setKdjM2] = useState(String(config.kdj.m2))

  /** 简单整数校验 */
  const parseIntSafe = (s: string): number | null => {
    const t = s.trim()
    if (t === '') return null
    const n = Number(t)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > PARAM_MAX) return null
    return n
  }
  const parseFloatSafe = (s: string): number | null => {
    const t = s.trim()
    if (t === '') return null
    const n = Number(t)
    if (!Number.isFinite(n)) return null
    return n
  }

  const addMaChip = () => {
    const n = parseIntSafe(maInput)
    if (n === null) {
      Taro.showToast({ title: `请输入 1-${PARAM_MAX} 的整数`, icon: 'none' })
      return
    }
    if (config.maPeriods.includes(n)) {
      Taro.showToast({ title: `${n} 已存在`, icon: 'none' })
      setMaInput('')
      return
    }
    setMaPeriods([...config.maPeriods, n])
    setMaInput('')
  }

  const removeMaChip = (period: number) => {
    const next = config.maPeriods.filter((p) => p !== period)
    if (next.length === 0) {
      Taro.showToast({ title: '至少保留 1 个 MA 周期', icon: 'none' })
      return
    }
    setMaPeriods(next)
  }

  const onSave = () => {
    // 校验 + 写入（store 内部再次校验兜底）
    const fast = parseIntSafe(macdFast)
    const slow = parseIntSafe(macdSlow)
    const signal = parseIntSafe(macdSignal)
    if (fast === null || slow === null || signal === null) {
      Taro.showToast({ title: 'MACD 参数必须是 1-200 的整数', icon: 'none' })
      return
    }
    if (fast >= slow) {
      Taro.showToast({ title: 'MACD fast 必须小于 slow', icon: 'none' })
      return
    }
    setMacdConfig(fast, slow, signal)

    const bp = parseIntSafe(bollPeriod)
    const bk = parseFloatSafe(bollK)
    if (bp === null) {
      Taro.showToast({ title: 'BOLL period 必须是 1-200 的整数', icon: 'none' })
      return
    }
    if (bk === null || bk < 0.1 || bk > 5) {
      Taro.showToast({ title: 'BOLL k 必须在 0.1-5', icon: 'none' })
      return
    }
    setBollConfig(bp, bk)

    const n = parseIntSafe(kdjN)
    const m1 = parseIntSafe(kdjM1)
    const m2 = parseIntSafe(kdjM2)
    if (n === null || m1 === null || m2 === null) {
      Taro.showToast({ title: 'KDJ 参数必须是 1-200 的整数', icon: 'none' })
      return
    }
    setKdjConfig(n, m1, m2)

    Taro.showToast({ title: '已保存', icon: 'success' })
  }

  const onReset = () => {
    Taro.showModal({
      title: '恢复默认指标参数？',
      content: 'MA: [5,10,20,60] / MACD: 12,26,9 / BOLL: 20,2 / KDJ: 9,3,3',
      success: (res) => {
        if (res.confirm) {
          reset()
          setMacdFast(String(DEFAULT_INDICATOR_CONFIG.macd.fast))
          setMacdSlow(String(DEFAULT_INDICATOR_CONFIG.macd.slow))
          setMacdSignal(String(DEFAULT_INDICATOR_CONFIG.macd.signal))
          setBollPeriod(String(DEFAULT_INDICATOR_CONFIG.boll.period))
          setBollK(String(DEFAULT_INDICATOR_CONFIG.boll.k))
          setKdjN(String(DEFAULT_INDICATOR_CONFIG.kdj.n))
          setKdjM1(String(DEFAULT_INDICATOR_CONFIG.kdj.m1))
          setKdjM2(String(DEFAULT_INDICATOR_CONFIG.kdj.m2))
          Taro.showToast({ title: '已恢复默认', icon: 'success' })
        }
      },
    })
  }

  return (
    <View className="flex flex-col h-full bg-slate-900">
      <ScrollView scrollY className="flex-1 smooth-scroll hide-scrollbar">
        <View className="px-4 py-4 gap-3 flex flex-col">
          {/* 当前配置概览 */}
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
            <CardContent className="p-4">
              <View className="flex flex-row items-center gap-2 mb-3">
                <SettingsIcon size={16} color="#3b82f6" />
                <Text className="block text-sm font-semibold text-slate-100">
                  当前生效配置
                </Text>
              </View>
              <View className="flex flex-col gap-1">
                <Text className="block text-xs text-slate-400">
                  MA 周期: {config.maPeriods.join(', ')}
                </Text>
                <Text className="block text-xs text-slate-400">
                  MACD: ({config.macd.fast}, {config.macd.slow}, {config.macd.signal})
                </Text>
                <Text className="block text-xs text-slate-400">
                  BOLL: ({config.boll.period}, {config.boll.k})
                </Text>
                <Text className="block text-xs text-slate-400">
                  KDJ: ({config.kdj.n}, {config.kdj.m1}, {config.kdj.m2})
                </Text>
              </View>
            </CardContent>
          </Card>

          {/* MA 折叠面板 */}
          <Accordion type="multiple" defaultValue={['ma']} className="bg-slate-800 border-slate-700 rounded-xl">
            <AccordionItem value="ma" className="border-slate-700">
              <AccordionTrigger className="px-4 text-slate-100">
                <View className="flex flex-row items-center gap-2">
                  <TrendingUp size={16} color="#a3e635" />
                  <Text className="text-sm font-medium text-slate-100">MA 移动平均线</Text>
                </View>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <View className="flex flex-col gap-3">
                  <Text className="block text-xs text-slate-500">
                    最多 {PARAM_MAX} 个周期，可任意添加 / 删除
                  </Text>
                  <View className="flex flex-row flex-wrap gap-2">
                    {config.maPeriods.map((p) => (
                      <View
                        key={p}
                        className="flex flex-row items-center gap-1 px-2 py-1 rounded-md bg-emerald-500 bg-opacity-20 border border-emerald-500 border-opacity-30"
                      >
                        <Text className="text-xs font-medium text-emerald-400">MA{p}</Text>
                        <View onClick={() => removeMaChip(p)}>
                          <Trash2 size={12} color="#10b981" />
                        </View>
                      </View>
                    ))}
                  </View>
                  <View className="flex flex-row items-center gap-2">
                    <Input
                      className="flex-1 bg-slate-900 border-slate-700 text-slate-100 h-9 text-sm"
                      type="number"
                      value={maInput}
                      placeholder="输入整数 1-200"
                      onInput={(e: any) => setMaInput(e.target.value)}
                    />
                    <Button
                      className="h-9 bg-emerald-500 text-white px-3"
                      onClick={addMaChip}
                    >
                      <Plus size={14} color="#ffffff" />
                      <Text className="text-xs">添加</Text>
                    </Button>
                  </View>
                </View>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* MACD 折叠面板 */}
          <Accordion type="multiple" className="bg-slate-800 border-slate-700 rounded-xl">
            <AccordionItem value="macd" className="border-slate-700">
              <AccordionTrigger className="px-4 text-slate-100">
                <Text className="text-sm font-medium text-slate-100">MACD 异同移动平均线</Text>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <View className="flex flex-col gap-3">
                  <View className="flex flex-row items-center gap-2">
                    <Text className="block text-xs text-slate-400 w-12">Fast</Text>
                    <Input
                      className="flex-1 bg-slate-900 border-slate-700 text-slate-100 h-9 text-sm"
                      type="number"
                      value={macdFast}
                      onInput={(e: any) => setMacdFast(e.target.value)}
                    />
                  </View>
                  <View className="flex flex-row items-center gap-2">
                    <Text className="block text-xs text-slate-400 w-12">Slow</Text>
                    <Input
                      className="flex-1 bg-slate-900 border-slate-700 text-slate-100 h-9 text-sm"
                      type="number"
                      value={macdSlow}
                      onInput={(e: any) => setMacdSlow(e.target.value)}
                    />
                  </View>
                  <View className="flex flex-row items-center gap-2">
                    <Text className="block text-xs text-slate-400 w-12">Signal</Text>
                    <Input
                      className="flex-1 bg-slate-900 border-slate-700 text-slate-100 h-9 text-sm"
                      type="number"
                      value={macdSignal}
                      onInput={(e: any) => setMacdSignal(e.target.value)}
                    />
                  </View>
                  <Text className="block text-xs text-slate-500">
                    fast 必须 &lt; slow；默认 (12, 26, 9)
                  </Text>
                </View>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* BOLL 折叠面板 */}
          <Accordion type="multiple" className="bg-slate-800 border-slate-700 rounded-xl">
            <AccordionItem value="boll" className="border-slate-700">
              <AccordionTrigger className="px-4 text-slate-100">
                <Text className="text-sm font-medium text-slate-100">BOLL 布林带</Text>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <View className="flex flex-col gap-3">
                  <View className="flex flex-row items-center gap-2">
                    <Text className="block text-xs text-slate-400 w-12">Period</Text>
                    <Input
                      className="flex-1 bg-slate-900 border-slate-700 text-slate-100 h-9 text-sm"
                      type="number"
                      value={bollPeriod}
                      onInput={(e: any) => setBollPeriod(e.target.value)}
                    />
                  </View>
                  <View className="flex flex-row items-center gap-2">
                    <Text className="block text-xs text-slate-400 w-12">K</Text>
                    <Input
                      className="flex-1 bg-slate-900 border-slate-700 text-slate-100 h-9 text-sm"
                      type="number"
                      value={bollK}
                      onInput={(e: any) => setBollK(e.target.value)}
                    />
                  </View>
                  <Text className="block text-xs text-slate-500">
                    period: 1-{PARAM_MAX}；k: 0.1-5（默认 20, 2）
                  </Text>
                </View>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* KDJ 折叠面板 */}
          <Accordion type="multiple" className="bg-slate-800 border-slate-700 rounded-xl">
            <AccordionItem value="kdj" className="border-slate-700">
              <AccordionTrigger className="px-4 text-slate-100">
                <Text className="text-sm font-medium text-slate-100">KDJ 随机指标</Text>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <View className="flex flex-col gap-3">
                  <View className="flex flex-row items-center gap-2">
                    <Text className="block text-xs text-slate-400 w-12">N</Text>
                    <Input
                      className="flex-1 bg-slate-900 border-slate-700 text-slate-100 h-9 text-sm"
                      type="number"
                      value={kdjN}
                      onInput={(e: any) => setKdjN(e.target.value)}
                    />
                  </View>
                  <View className="flex flex-row items-center gap-2">
                    <Text className="block text-xs text-slate-400 w-12">M1</Text>
                    <Input
                      className="flex-1 bg-slate-900 border-slate-700 text-slate-100 h-9 text-sm"
                      type="number"
                      value={kdjM1}
                      onInput={(e: any) => setKdjM1(e.target.value)}
                    />
                  </View>
                  <View className="flex flex-row items-center gap-2">
                    <Text className="block text-xs text-slate-400 w-12">M2</Text>
                    <Input
                      className="flex-1 bg-slate-900 border-slate-700 text-slate-100 h-9 text-sm"
                      type="number"
                      value={kdjM2}
                      onInput={(e: any) => setKdjM2(e.target.value)}
                    />
                  </View>
                  <Text className="block text-xs text-slate-500">
                    默认 (9, 3, 3)；范围 1-{PARAM_MAX}
                  </Text>
                </View>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Separator className="my-2 bg-slate-700" />

          {/* 底部按钮组 */}
          <View className="flex flex-row gap-2">
            <Button
              className="flex-1 h-11 bg-slate-700 text-slate-200"
              onClick={onReset}
            >
              <RotateCcw size={14} color="#cbd5e1" />
              <Text className="text-sm">恢复默认</Text>
            </Button>
            <Button
              className="flex-[2] h-11 bg-emerald-500 text-white"
              onClick={onSave}
            >
              <Save size={14} color="#ffffff" />
              <Text className="text-sm font-medium">保存设置</Text>
            </Button>
          </View>

          {/* 提示 */}
          <Card className="bg-blue-500 bg-opacity-10 border-blue-500 border-opacity-30">
            <CardContent className="p-3">
              <Text className="block text-xs text-blue-300">
                参数修改后，下次加载 K 线图会自动应用。指标周期大小影响 warmup
                时间；过长周期可能导致前 N 根 K 线无指标值。
              </Text>
            </CardContent>
          </Card>

          {/* 当前 MA 列表统计 */}
          <View className="flex flex-row items-center justify-center gap-2 pt-2">
            <Badge className="bg-slate-800 text-slate-400 border-slate-700">
              <Text className="text-xs">MA 数: {config.maPeriods.length}</Text>
            </Badge>
            <Badge className="bg-slate-800 text-slate-400 border-slate-700">
              <Text className="text-xs">范围: {Math.min(...config.maPeriods)}-{Math.max(...config.maPeriods)}</Text>
            </Badge>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default IndicatorSettingsPage
