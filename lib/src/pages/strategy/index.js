import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Brain, Zap, TrendingUp, TrendingDown, Play, Pause, Settings, Activity, Clock, Target, Plus, Radio, ChartBar, Copy, Trash2, } from 'lucide-react-taro';
const StrategyPage = () => {
    const [autoTrade, setAutoTrade] = useState(false);
    const [strategies, setStrategies] = useState([]);
    const [agentSignals, setAgentSignals] = useState([]);
    const [monitorSignals, setMonitorSignals] = useState([]);
    const [agentActive, setAgentActive] = useState(false);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        loadStrategies();
        loadSignals();
        loadAgentStatus();
        loadMonitorSignals();
    }, []);
    const loadStrategies = async () => {
        var _a;
        try {
            const res = await Network.request({ url: '/api/strategies' });
            console.log('strategies:', res.data);
            const data = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            if (data)
                setStrategies(data);
        }
        catch (e) {
            console.error('loadStrategies error:', e);
        }
    };
    const loadSignals = async () => {
        var _a;
        try {
            const res = await Network.request({ url: '/api/agent/signals?limit=5' });
            console.log('signals:', res.data);
            const data = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            if (data)
                setAgentSignals(data);
        }
        catch (e) {
            console.error('loadSignals error:', e);
        }
    };
    const loadAgentStatus = async () => {
        var _a;
        try {
            const res = await Network.request({ url: '/api/agent/status' });
            const data = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            if (data)
                setAgentActive(data.isActive);
        }
        catch (e) {
            console.error('loadAgentStatus error:', e);
        }
        finally {
            setLoading(false);
        }
    };
    const loadMonitorSignals = async () => {
        var _a;
        try {
            const res = await Network.request({ url: '/api/strategies/monitor/signals?limit=5' });
            console.log('monitor signals:', res.data);
            const data = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            if (data)
                setMonitorSignals(data);
        }
        catch (e) {
            console.error('loadMonitorSignals error:', e);
        }
    };
    const toggleAgent = async () => {
        try {
            const method = agentActive ? 'POST' : 'POST';
            const action = agentActive ? 'stop' : 'start';
            const res = await Network.request({
                url: `/api/agent/${action}`,
                method,
            });
            console.log('toggle agent:', res.data);
            setAgentActive(!agentActive);
        }
        catch (e) {
            console.error('toggleAgent error:', e);
        }
    };
    const toggleStrategy = async (id, currentStatus) => {
        try {
            const action = currentStatus === 'running' ? 'stop' : 'start';
            const res = await Network.request({
                url: `/api/strategies/${id}/${action}`,
                method: 'POST',
            });
            console.log('toggle strategy:', res.data);
            loadStrategies();
        }
        catch (e) {
            console.error('toggleStrategy error:', e);
        }
    };
    const copyStrategy = async (s) => {
        var _a, _b;
        try {
            const res = await Network.request({
                url: '/api/strategies/custom',
                method: 'POST',
                data: {
                    name: `${s.name} 副本`,
                    symbol: s.symbol || '600519',
                    buyConditions: s.buyConditions || [{ indicator: 'price', operator: 'lte', value: 90 }],
                    sellConditions: s.sellConditions || [{ indicator: 'price', operator: 'gte', value: 110 }],
                    monitorEnabled: false,
                    autoTrade: false,
                },
            });
            if ((_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.id) {
                Taro.showToast({ title: '已复制为自定义策略', icon: 'success' });
                loadStrategies();
            }
        }
        catch (e) {
            Taro.showToast({ title: '复制失败', icon: 'none' });
        }
    };
    const deleteStrategy = (id) => {
        Taro.showModal({
            title: '删除策略',
            content: '确定删除该自定义策略吗？删除后不可恢复。',
            confirmColor: '#ef4444',
            success: async (r) => {
                if (!r.confirm)
                    return;
                try {
                    await Network.request({ url: `/api/strategies/custom/${id}`, method: 'DELETE' });
                    Taro.showToast({ title: '已删除', icon: 'success' });
                    loadStrategies();
                }
                catch (e) {
                    Taro.showToast({ title: '删除失败', icon: 'none' });
                }
            },
        });
    };
    return (_jsx(ScrollView, { scrollY: true, className: "h-full bg-slate-900 smooth-scroll hide-scrollbar tabbar-page", children: _jsxs(View, { className: "px-4 pb-8 gap-4 flex flex-col", children: [_jsx(Card, { className: "bg-slate-800 border-slate-700 mt-4", children: _jsxs(CardContent, { className: "p-4", children: [_jsx(View, { className: "flex flex-row items-center justify-between mb-3", children: _jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(View, { className: `flex items-center justify-center w-10 h-10 rounded-lg ${agentActive
                                                ? 'bg-emerald-500 bg-opacity-20'
                                                : 'bg-slate-700'}`, children: _jsx(Brain, { size: 22, color: agentActive ? '#10b981' : '#64748b' }) }), _jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-base font-bold text-slate-100", children: "AI \u91CF\u5316 Agent" }), _jsx(Text, { className: "block text-xs text-slate-500", children: agentActive ? '正在分析市场并执行策略' : 'Agent 已停止运行' })] })] }) }), _jsxs(View, { className: "flex flex-row items-center justify-between bg-slate-900 rounded-lg p-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Zap, { size: 16, color: "#f59e0b" }), _jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-sm font-medium text-slate-100", children: "\u81EA\u52A8\u4EA4\u6613" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "Agent \u81EA\u52A8\u6267\u884C\u4E70\u5356\u4FE1\u53F7" })] })] }), _jsx(Switch, { checked: autoTrade, onCheckedChange: setAutoTrade })] }), _jsxs(View, { className: "flex flex-row gap-2 mt-3", children: [_jsx(Button, { className: `flex-1 ${agentActive ? 'bg-red-500 bg-opacity-20 text-red-400' : 'bg-emerald-500 text-white'}`, onClick: toggleAgent, children: agentActive ? (_jsxs(_Fragment, { children: [_jsx(Pause, { size: 14, color: "#f87171" }), _jsx(Text, { className: "text-sm font-medium ml-1", children: "\u505C\u6B62 Agent" })] })) : (_jsxs(_Fragment, { children: [_jsx(Play, { size: 14, color: "#ffffff" }), _jsx(Text, { className: "text-sm font-medium ml-1", children: "\u542F\u52A8 Agent" })] })) }), _jsxs(Button, { className: "flex-1 bg-slate-700 text-slate-100", variant: "secondary", children: [_jsx(Settings, { size: 14, color: "#f1f5f9" }), _jsx(Text, { className: "text-sm font-medium ml-1", children: "Agent \u914D\u7F6E" })] })] })] }) }), _jsxs(View, { className: "flex flex-col gap-3", children: [_jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsx(Text, { className: "block text-base font-bold text-slate-100", children: "\u7B56\u7565\u7BA1\u7406" }), _jsxs(View, { className: "flex flex-row gap-2", children: [_jsxs(Button, { variant: "outline", className: "bg-blue-500 bg-opacity-10 border-blue-500 border-opacity-30 text-blue-400 h-8 px-3", onClick: () => Taro.navigateTo({ url: '/pages/backtest/index' }), children: [_jsx(ChartBar, { size: 14, color: "#60a5fa" }), _jsx(Text, { className: "text-xs ml-1", children: "\u56DE\u6D4B" })] }), _jsxs(Button, { variant: "outline", className: "bg-amber-500 bg-opacity-10 border-amber-500 border-opacity-30 text-amber-400 h-8 px-3", onClick: () => Taro.navigateTo({ url: '/pages/paper-trading/index' }), children: [_jsx(Activity, { size: 14, color: "#fbbf24" }), _jsx(Text, { className: "text-xs ml-1", children: "\u6A21\u62DF\u4EA4\u6613" })] }), _jsxs(Button, { className: "bg-emerald-500 bg-opacity-20 text-emerald-400 h-8 px-3", onClick: () => Taro.navigateTo({ url: '/pages/strategy/create' }), children: [_jsx(Plus, { size: 14, color: "#34d399" }), _jsx(Text, { className: "text-xs ml-1", children: "\u65B0\u5EFA" })] })] })] }), loading ? (_jsx(View, { className: "flex items-center justify-center py-8", children: _jsx(Text, { className: "block text-sm text-slate-500", children: "\u52A0\u8F7D\u4E2D..." }) })) : (strategies.map((s) => (_jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-4", children: [_jsx(View, { className: "flex flex-row items-start justify-between mb-2", children: _jsxs(View, { className: "flex flex-col gap-1 flex-1", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-sm font-semibold text-slate-100", children: s.name }), !s.isCustom && (_jsx(Badge, { className: "bg-slate-600 bg-opacity-40 text-slate-300 border-slate-500 border-opacity-40", children: "\u6A21\u677F" })), s.isCustom && (_jsx(Badge, { className: "bg-purple-500 bg-opacity-20 text-purple-400 border-purple-500 border-opacity-30", children: "\u81EA\u5B9A\u4E49" })), s.monitorEnabled && s.status === 'running' && (_jsxs(Badge, { className: "bg-violet-500 bg-opacity-20 text-violet-400 border-violet-500 border-opacity-30", children: [_jsx(Radio, { size: 10, color: "#a78bfa" }), _jsx(Text, { className: "text-xs ml-1", children: "\u76D1\u542C\u4E2D" })] }))] }), _jsx(Text, { className: "block text-xs text-slate-500", children: s.description }), s.isCustom && s.symbol && (_jsxs(Text, { className: "block text-xs text-slate-400", children: ["\u6807\u7684: ", s.symbol, " | ", s.autoTrade ? '自动交易' : '仅信号'] }))] }) }), _jsxs(View, { className: "flex flex-row gap-2 mt-2", children: [_jsxs(View, { className: "flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-2", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u6536\u76CA" }), _jsxs(Text, { className: `block text-sm font-bold tabular-nums ${s.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`, children: [s.pnl >= 0 ? '+' : '', s.pnlRate.toFixed(2), "%"] })] }), _jsxs(View, { className: "flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-2", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u80DC\u7387" }), _jsxs(Text, { className: "block text-sm font-bold text-blue-500 tabular-nums", children: [s.winRate, "%"] })] }), _jsxs(View, { className: "flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-2", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u4EA4\u6613\u6B21\u6570" }), _jsx(Text, { className: "block text-sm font-bold text-slate-100 tabular-nums", children: s.trades })] })] }), _jsxs(View, { className: "flex flex-row gap-2 mt-3", children: [s.isCustom ? (_jsx(Button, { className: `flex-1 h-8 ${s.status === 'running'
                                                    ? 'bg-red-500 bg-opacity-20 text-red-400'
                                                    : 'bg-emerald-500 bg-opacity-20 text-emerald-400'}`, onClick: () => toggleStrategy(s.id, s.status), children: _jsx(Text, { className: "text-xs font-medium", children: s.status === 'running' ? '停止' : '启动' }) })) : (_jsxs(Button, { className: "flex-1 h-8 bg-emerald-500 bg-opacity-20 text-emerald-400", onClick: () => copyStrategy(s), children: [_jsx(Copy, { size: 12, color: "#34d399" }), _jsx(Text, { className: "text-xs font-medium ml-1", children: "\u590D\u5236\u4E3A\u81EA\u5B9A\u4E49" })] })), s.isCustom && (_jsxs(Button, { className: "flex-1 h-8 bg-blue-500 bg-opacity-20 text-blue-400", variant: "secondary", onClick: () => {
                                                    Taro.navigateTo({
                                                        url: `/pages/backtest/index?symbol=${s.symbol || '600519'}&strategyId=${s.id}`,
                                                    });
                                                }, children: [_jsx(Activity, { size: 12, color: "#60a5fa" }), _jsx(Text, { className: "text-xs font-medium ml-1", children: "\u56DE\u6D4B" })] })), s.isCustom && (_jsxs(Button, { className: "flex-1 h-8 bg-slate-700 text-slate-300", variant: "secondary", onClick: () => Taro.navigateTo({ url: `/pages/strategy/create?id=${s.id}` }), children: [_jsx(Target, { size: 12, color: "#cbd5e1" }), _jsx(Text, { className: "text-xs font-medium ml-1", children: "\u7F16\u8F91" })] })), s.isCustom && (_jsxs(Button, { className: "flex-1 h-8 bg-red-500 bg-opacity-20 text-red-400", variant: "secondary", onClick: () => deleteStrategy(s.id), children: [_jsx(Trash2, { size: 12, color: "#f87171" }), _jsx(Text, { className: "text-xs font-medium ml-1", children: "\u5220\u9664" })] }))] })] }) }, s.id))))] }), _jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center justify-between mb-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Zap, { size: 14, color: "#f59e0b" }), _jsx(Text, { className: "block text-sm font-semibold text-slate-100", children: "Agent \u4FE1\u53F7\u6D41" })] }), _jsx(Badge, { className: "bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30", children: "\u5B9E\u65F6" })] }), agentSignals.length === 0 ? (_jsx(View, { className: "flex items-center justify-center py-6", children: _jsx(Text, { className: "block text-sm text-slate-500", children: "\u6682\u65E0\u4FE1\u53F7" }) })) : (_jsx(View, { className: "flex flex-col gap-2", children: agentSignals.map((sig, idx) => (_jsxs(View, { children: [_jsxs(View, { className: "flex flex-row items-center justify-between bg-slate-900 rounded-lg p-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2 flex-1", children: [sig.type === 'buy' ? (_jsx(TrendingUp, { size: 14, color: "#22c55e" })) : (_jsx(TrendingDown, { size: 14, color: "#ef4444" })), _jsxs(View, { className: "flex flex-col gap-1 flex-1", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsxs(Text, { className: "block text-sm font-medium text-slate-100", children: [sig.type === 'buy' ? '买入' : '卖出', " ", sig.symbol] }), _jsxs(Badge, { className: `text-xs ${sig.type === 'buy'
                                                                                ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30'
                                                                                : 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30'}`, children: ["\u7F6E\u4FE1\u5EA6 ", sig.confidence, "%"] }), sig.executed && (_jsx(Badge, { className: "bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30 text-xs", children: "\u5DF2\u6267\u884C" }))] }), _jsx(Text, { className: "block text-xs text-slate-500", children: sig.reason })] })] }), _jsxs(View, { className: "flex flex-col items-end gap-1", children: [_jsxs(Text, { className: "block text-sm font-medium text-slate-100 tabular-nums", children: ["$", sig.price.toLocaleString()] }), _jsxs(View, { className: "flex flex-row items-center gap-1", children: [_jsx(Clock, { size: 10, color: "#64748b" }), _jsx(Text, { className: "block text-xs text-slate-500", children: sig.time })] })] })] }), idx < agentSignals.length - 1 && (_jsx(Separator, { className: "bg-slate-700 my-0" }))] }, sig.id))) }))] }) }), monitorSignals.length > 0 && (_jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center justify-between mb-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Radio, { size: 14, color: "#8b5cf6" }), _jsx(Text, { className: "block text-sm font-semibold text-slate-100", children: "\u7B56\u7565\u76D1\u542C\u4FE1\u53F7" })] }), _jsx(Badge, { className: "bg-violet-500 bg-opacity-20 text-violet-400 border-violet-500 border-opacity-30", children: "\u76D1\u542C\u4E2D" })] }), _jsx(View, { className: "flex flex-col gap-2", children: monitorSignals.map((sig) => (_jsxs(View, { className: "flex flex-row items-center justify-between bg-slate-900 rounded-lg p-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2 flex-1", children: [sig.type === 'buy' ? (_jsx(TrendingUp, { size: 14, color: "#22c55e" })) : (_jsx(TrendingDown, { size: 14, color: "#ef4444" })), _jsxs(View, { className: "flex flex-col gap-1 flex-1", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-xs font-medium text-slate-100", children: sig.strategyName }), _jsx(Badge, { className: `text-xs ${sig.type === 'buy'
                                                                        ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30'
                                                                        : 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30'}`, children: sig.type === 'buy' ? '买入' : '卖出' }), sig.executed && (_jsx(Badge, { className: "bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30 text-xs", children: "\u5DF2\u6267\u884C" }))] }), _jsx(Text, { className: "block text-xs text-slate-500", children: sig.reason })] })] }), _jsxs(View, { className: "flex flex-col items-end gap-1", children: [_jsx(Text, { className: "block text-xs font-medium text-slate-100 tabular-nums", children: sig.symbol }), _jsx(Text, { className: "block text-xs text-slate-500", children: new Date(sig.time).toLocaleTimeString() })] })] }, sig.id))) })] }) }))] }) }));
};
export default StrategyPage;
//# sourceMappingURL=index.js.map