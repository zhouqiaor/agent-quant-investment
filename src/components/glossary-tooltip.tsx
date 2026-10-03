import * as React from 'react'
import { View, Text } from '@tarojs/components'
import { Network } from '@/network'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface GlossaryEntry {
  term: string
  short: string
  detail: string
  formula?: string
  example?: string
}

type Cache = Record<string, GlossaryEntry | null>
const cache: Cache = {}
let inflight: Promise<unknown> | null = null

async function loadAll(): Promise<void> {
  if (Object.keys(cache).length > 0) return
  if (inflight) {
    await inflight
    return
  }
  const p: Promise<void> = (async () => {
    try {
      const res = await Network.request<{ data: GlossaryEntry[] }>({
        url: '/api/glossary',
      })
      for (const e of res.data.data ?? []) {
        cache[e.term.toLowerCase().replace(/[^a-z_]/g, '')] = e
      }
    } catch {
      // ignore - tooltip will fall back to "no data"
    } finally {
      inflight = null
    }
  })()
  inflight = p
  return p
}

function findByKey(key: string): GlossaryEntry | null {
  const norm = key.toLowerCase().replace(/[^a-z_]/g, '')
  return cache[norm] ?? null
}

type Props = {
  /** glossary key，例如 'sharpe' / 'momentum' / 'ma_cross' */
  term: string
  /** 触发提示的子元素（必须能点击/hover） */
  children: React.ReactNode
}

/**
 * 点按某个术语后弹出"教学卡片"
 * - 术语短解：1-2 句话
 * - 详细说明：含公式 / 例子
 *
 * 后端未就绪时静默降级（不弹窗）
 */
export function GlossaryTooltip({ term, children }: Props) {
  const [entry, setEntry] = React.useState<GlossaryEntry | null>(findByKey(term))

  React.useEffect(() => {
    void loadAll().then(() => setEntry(findByKey(term)))
  }, [term])

  return (
    <Tooltip>
      <TooltipTrigger>{children}</TooltipTrigger>
      {entry ? (
        <TooltipContent>
          <View className="max-w-xs p-2">
            <Text className="block text-sm font-semibold mb-1">{entry.term}</Text>
            <Text className="block text-xs leading-relaxed mb-1">{entry.short}</Text>
            <Text className="block text-xs leading-relaxed text-muted-foreground">{entry.detail}</Text>
            {entry.formula ? (
              <Text className="block text-xs mt-1 font-mono">公式：{entry.formula}</Text>
            ) : null}
            {entry.example ? (
              <Text className="block text-xs mt-1 italic text-muted-foreground">{entry.example}</Text>
            ) : null}
          </View>
        </TooltipContent>
      ) : null}
    </Tooltip>
  )
}