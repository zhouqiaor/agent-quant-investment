# Design Guidelines — Agent 量化投资小程序

## 品牌定位

- **应用定位**：AI Agent 驱动的量化投资交易终端
- **设计风格**：深色专业交易终端，冷静、精准、数据驱动
- **目标用户**：相信算法和数据的量化交易者

## 配色方案

### 主色板（深色主题）

| 用途 | Tailwind 类名 | 色值 |
|------|--------------|------|
| 背景 | `bg-slate-900` | #0f172a |
| 卡片/面板 | `bg-slate-800` | #1e293b |
| 卡片悬浮 | `bg-slate-700` | #334155 |
| 主色-盈利 | `text-emerald-500` / `bg-emerald-500` | #10b981 |
| 辅色-科技 | `text-blue-500` / `bg-blue-500` | #3b82f6 |
| 强调-Agent | `text-amber-500` / `bg-amber-500` | #f59e0b |

### 语义色

| 用途 | Tailwind 类名 |
|------|--------------|
| 涨/盈利 | `text-green-500` / `bg-green-500` |
| 跌/亏损 | `text-red-500` / `bg-red-500` |
| 警告 | `text-amber-500` |
| 文字主色 | `text-slate-100` |
| 文字次色 | `text-slate-400` |
| 文字弱化 | `text-slate-500` |
| 边框 | `border-slate-700` |

## 字体规范

- 总资产：`text-3xl font-bold text-slate-100 tabular-nums`
- 收益率：`text-xl font-semibold tabular-nums`
- 标题：`text-lg font-semibold text-slate-100`
- 正文：`text-sm text-slate-300`
- 标签：`text-xs text-slate-400 uppercase tracking-wider`
- 数据数字：始终使用 `tabular-nums`

## 间距系统

- 页面边距：`px-4`
- 卡片间距：`gap-3` 或 `gap-4`
- 卡片内边距：`p-4`
- 列表项间距：`space-y-2` 或 `gap-2`
- 区块间距：`gap-6`

## 组件使用原则

- 通用 UI 组件优先使用 `@/components/ui/*`
- 按钮：`Button`（variant 区分主次操作）
- 卡片容器：`Card` + `CardContent`
- 标签：`Badge`（涨跌、策略状态）
- 切换：`Tabs`（行情分类、持仓分类）
- 进度：`Progress`（策略回测进度）
- 开关：`Switch`（策略启停、自动交易开关）
- 弹窗：`Dialog`（交易确认、策略配置）
- 空状态/加载态：`Skeleton` 骨架屏

## 导航结构

TabBar 四个页面：
1. **首页**（仪表盘）— 资产概览、收益曲线、Agent状态
2. **行情**（市场）— 实时行情、涨跌排行
3. **策略**（Agent）— AI Agent、策略管理、交易信号
4. **我的**（账户）— 持仓、交易历史、设置

## 小程序约束

- 图片资源使用 TOS 对象存储 URL
- 数据展示使用 `tabular-nums` 保证数字对齐
- 避免过多动画影响性能
- 列表使用虚拟滚动或分页
