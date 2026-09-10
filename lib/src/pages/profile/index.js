import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import { Network } from '@/network';
import Taro from '@tarojs/taro';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CircleCheck, CircleAlert, Database, ChevronRight, Wallet, TrendingUp, TrendingDown, Clock, ArrowUpRight, ArrowDownRight, Shield, Bell, TriangleAlert, RotateCcw, } from 'lucide-react-taro';
const ProfilePage = () => {
    const [tab, setTab] = useState('positions');
    const [positions, setPositions] = useState([]);
    const [trades, setTrades] = useState([]);
    const [risk, setRisk] = useState({
        maxDrawdown: 10,
        stopLossRate: 5,
        takeProfitRate: 10,
        maxPositionRate: 30,
        dailyTradeLimit: 20,
    });
    const [notifyEnabled, setNotifyEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [dataSources, setDataSources] = useState([]);
    const [dataSourcesOpen, setDataSourcesOpen] = useState(false);
    const loadDataSources = async () => {
        var _a;
        try {
            const res = await Network.request({ url: '/api/data-sources' });
            const data = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            if (data && Array.isArray(data.data))
                setDataSources(data.data);
        }
        catch (e) {
            console.error('loadDataSources error:', e);
        }
    };
    useEffect(() => {
        loadPositions();
        loadTrades();
        loadRiskSettings();
        loadDataSources();
    }, []);
    const loadPositions = async () => {
        var _a;
        try {
            const res = await Network.request({ url: '/api/assets/positions/detail' });
            console.log('positions detail:', res.data);
            const data = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            if (data)
                setPositions(data);
        }
        catch (e) {
            console.error('loadPositions error:', e);
        }
    };
    const loadTrades = async () => {
        var _a;
        try {
            const res = await Network.request({ url: '/api/trades/history?limit=10' });
            console.log('trades:', res.data);
            const data = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            if (data)
                setTrades(data);
        }
        catch (e) {
            console.error('loadTrades error:', e);
        }
        finally {
            setLoading(false);
        }
    };
    const loadRiskSettings = async () => {
        var _a;
        try {
            const res = await Network.request({ url: '/api/risk/settings' });
            const data = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            if (data)
                setRisk(data);
        }
        catch (e) {
            console.error('loadRiskSettings error:', e);
        }
    };
    const saveRiskSettings = async () => {
        try {
            const res = await Network.request({
                url: '/api/risk/settings',
                method: 'POST',
                data: risk,
            });
            console.log('save risk:', res.data);
        }
        catch (e) {
            console.error('saveRiskSettings error:', e);
        }
    };
    const [resetOpen, setResetOpen] = useState(false);
    const handleResetAll = async () => {
        try {
            await Network.request({ url: '/api/beta/reset-all', method: 'POST' });
            Taro.showToast({ title: '已重置为从零配置', icon: 'success' });
            Taro.switchTab({ url: '/pages/index/index' });
        }
        catch (e) {
            Taro.showToast({ title: '重置失败', icon: 'none' });
        }
    };
    return (_jsxs(View, { className: "flex flex-col h-full bg-slate-900", children: [_jsx(View, { className: "px-4 pt-3", children: _jsx(Card, { className: "bg-slate-800 border-slate-700", onClick: () => setDataSourcesOpen(true), children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center justify-between mb-2", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Database, { size: 16, color: "#94a3b8" }), _jsx(Text, { className: "block text-sm text-slate-200 font-medium", children: "\u6570\u636E\u6765\u6E90" })] }), _jsx(ChevronRight, { size: 16, color: "#64748b" })] }), _jsx(View, { className: "flex flex-row items-center gap-3 mt-2", children: dataSources.length === 0 ? (_jsx(Text, { className: "block text-xs text-slate-500", children: "\u52A0\u8F7D\u4E2D\u2026" })) : (dataSources.map((src) => {
                                    const ok = src.status === 'ok';
                                    return (_jsxs(View, { className: "flex flex-row items-center gap-1", children: [ok ? (_jsx(CircleCheck, { size: 12, color: "#4ade80" })) : (_jsx(CircleAlert, { size: 12, color: "#f87171" })), _jsx(Text, { className: "block text-xs text-slate-300", children: src.name })] }, src.key));
                                })) })] }) }) }), _jsx(AlertDialog, { open: dataSourcesOpen, onOpenChange: setDataSourcesOpen, children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u5173\u4E8E\u6570\u636E\u6765\u6E90" }), _jsx(AlertDialogDescription, { children: "\u672C\u5E94\u7528\u6240\u6709\u884C\u60C5/\u80A1\u7968\u6570\u636E\u6765\u81EA\u4EE5\u4E0B\u4E09\u65B9\u516C\u5F00\u63A5\u53E3\uFF0C\u6309\u4F18\u5148\u7EA7\u81EA\u52A8\u964D\u7EA7\u3002" })] }), _jsxs(View, { className: "flex flex-col gap-3 my-2", children: [dataSources.map((src) => {
                                    const ok = src.status === 'ok';
                                    return (_jsxs(View, { className: "bg-slate-800 rounded-lg p-3", children: [_jsxs(View, { className: "flex flex-row items-center justify-between mb-1", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [ok ? (_jsx(CircleCheck, { size: 14, color: "#4ade80" })) : (_jsx(CircleAlert, { size: 14, color: "#f87171" })), _jsx(Text, { className: "block text-sm font-medium text-slate-200", children: src.name })] }), _jsx(Text, { className: "block text-xs text-slate-500", children: ok ? '可用' : src.status === 'degraded' ? '降级' : '不可用' })] }), _jsx(Text, { className: "block text-xs text-slate-400 mb-1", children: src.description }), src.detail && (_jsx(Text, { className: "block text-xs text-slate-500", children: src.detail }))] }, src.key));
                                }), _jsx(View, { className: "bg-slate-900 border border-slate-700 rounded-lg p-3", children: _jsxs(Text, { className: "block text-xs text-slate-400 leading-relaxed", children: [_jsx(Text, { className: "block text-xs text-slate-300 font-medium mb-1", children: "\u514D\u8D23\u58F0\u660E" }), "\u4EE5\u4E0A\u6570\u636E\u6765\u81EA\u7B2C\u4E09\u65B9\u516C\u5F00\u63A5\u53E3\uFF0C\u4EC5\u7528\u4E8E\u5B66\u4E60\u4E0E\u6280\u672F\u7814\u7A76\uFF0C\u4E0D\u6784\u6210\u4EFB\u4F55\u6295\u8D44\u5EFA\u8BAE\u3002 \u8BF7\u52FF\u7528\u4E8E\u771F\u5B9E\u4EA4\u6613\uFF0C\u4F7F\u7528\u8005\u9700\u81EA\u884C\u627F\u62C5\u98CE\u9669\u3002"] }) })] }), _jsx(AlertDialogFooter, { children: _jsx(AlertDialogAction, { children: "\u6211\u77E5\u9053\u4E86" }) })] }) }), _jsxs(Tabs, { value: tab, onValueChange: setTab, className: "flex-1", children: [_jsx(View, { className: "px-4 pt-3", children: _jsxs(TabsList, { className: "bg-slate-800", children: [_jsx(TabsTrigger, { value: "positions", children: "\u6301\u4ED3" }), _jsx(TabsTrigger, { value: "trades", children: "\u4EA4\u6613\u8BB0\u5F55" }), _jsx(TabsTrigger, { value: "risk", children: "\u98CE\u63A7" })] }) }), _jsx(TabsContent, { value: "positions", className: "flex-1", children: _jsx(ScrollView, { scrollY: true, className: "flex-1 smooth-scroll hide-scrollbar", children: _jsx(View, { className: "px-4 pb-20 gap-3 flex flex-col", children: loading ? (_jsx(View, { className: "flex items-center justify-center py-12", children: _jsx(Text, { className: "block text-sm text-slate-500", children: "\u52A0\u8F7D\u4E2D..." }) })) : positions.length === 0 ? (_jsxs(View, { className: "flex flex-col items-center justify-center py-16 gap-3", children: [_jsx(Wallet, { size: 40, color: "#334155" }), _jsx(Text, { className: "block text-sm text-slate-500", children: "\u6682\u65E0\u6301\u4ED3" })] })) : (positions.map((pos) => (_jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center justify-between mb-2", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-sm font-semibold text-slate-100", children: pos.symbol }), _jsxs(Badge, { className: pos.side === 'long'
                                                                    ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30'
                                                                    : 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30', children: [pos.side === 'long' ? 'MULTI' : 'EMPTY', " ", pos.leverage, "x"] })] }), _jsxs(View, { className: "flex flex-row items-center gap-1", children: [pos.pnl >= 0 ? (_jsx(ArrowUpRight, { size: 14, color: "#22c55e" })) : (_jsx(ArrowDownRight, { size: 14, color: "#ef4444" })), _jsxs(Text, { className: `block text-sm font-bold tabular-nums ${pos.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`, children: [pos.pnl >= 0 ? '+' : '', pos.pnl.toFixed(2), " (", pos.pnlRate >= 0 ? '+' : '', pos.pnlRate.toFixed(2), "%)"] })] })] }), _jsxs(View, { className: "flex flex-row gap-2", children: [_jsxs(View, { className: "flex flex-1 flex-col gap-1 bg-slate-900 rounded-lg p-2", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u5F00\u4ED3\u4EF7" }), _jsxs(Text, { className: "block text-xs font-medium text-slate-100 tabular-nums", children: ["$", pos.entryPrice.toLocaleString()] })] }), _jsxs(View, { className: "flex flex-1 flex-col gap-1 bg-slate-900 rounded-lg p-2", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u5F53\u524D\u4EF7" }), _jsxs(Text, { className: "block text-xs font-medium text-slate-100 tabular-nums", children: ["$", pos.currentPrice.toLocaleString()] })] }), _jsxs(View, { className: "flex flex-1 flex-col gap-1 bg-slate-900 rounded-lg p-2", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u6570\u91CF" }), _jsx(Text, { className: "block text-xs font-medium text-slate-100 tabular-nums", children: pos.quantity })] }), _jsxs(View, { className: "flex flex-1 flex-col gap-1 bg-slate-900 rounded-lg p-2", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u4FDD\u8BC1\u91D1" }), _jsxs(Text, { className: "block text-xs font-medium text-amber-500 tabular-nums", children: ["$", pos.margin.toFixed(0)] })] })] }), _jsxs(View, { className: "flex flex-row gap-2 mt-2", children: [_jsx(Button, { className: "flex-1 h-8 bg-red-500 bg-opacity-20 text-red-400", children: _jsx(Text, { className: "text-xs font-medium", children: "\u5E73\u4ED3" }) }), _jsx(Button, { className: "flex-1 h-8 bg-slate-700 text-slate-300", variant: "secondary", children: _jsx(Text, { className: "text-xs font-medium", children: "\u8C03\u6574" }) })] })] }) }, pos.symbol)))) }) }) }), _jsx(TabsContent, { value: "trades", className: "flex-1", children: _jsx(ScrollView, { scrollY: true, className: "flex-1 smooth-scroll hide-scrollbar", children: _jsx(View, { className: "px-4 pb-20 gap-2 flex flex-col", children: loading ? (_jsx(View, { className: "flex items-center justify-center py-12", children: _jsx(Text, { className: "block text-sm text-slate-500", children: "\u52A0\u8F7D\u4E2D..." }) })) : trades.length === 0 ? (_jsxs(View, { className: "flex flex-col items-center justify-center py-16 gap-3", children: [_jsx(Clock, { size: 40, color: "#334155" }), _jsx(Text, { className: "block text-sm text-slate-500", children: "\u6682\u65E0\u4EA4\u6613\u8BB0\u5F55" })] })) : (trades.map((t) => (_jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-3", children: [_jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [t.type === 'buy' ? (_jsx(TrendingUp, { size: 14, color: "#22c55e" })) : (_jsx(TrendingDown, { size: 14, color: "#ef4444" })), _jsxs(View, { className: "flex flex-col gap-1", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsxs(Text, { className: "block text-sm font-medium text-slate-100", children: [t.type === 'buy' ? '买入' : '卖出', " ", t.symbol] }), _jsxs(Text, { className: "block text-xs text-slate-500", children: ["x", t.quantity] })] }), _jsxs(Text, { className: "block text-xs text-slate-500", children: ["\u7B56\u7565: ", t.strategy] })] })] }), _jsxs(View, { className: "flex flex-col items-end gap-1", children: [_jsxs(Text, { className: "block text-sm font-medium text-slate-100 tabular-nums", children: ["$", t.price.toLocaleString()] }), _jsxs(Text, { className: `block text-xs tabular-nums ${t.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`, children: [t.pnl >= 0 ? '+' : '', t.pnl.toFixed(2)] })] })] }), _jsxs(View, { className: "flex flex-row items-center justify-between mt-2", children: [_jsxs(Text, { className: "block text-xs text-slate-500", children: ["\u91D1\u989D: $", t.amount.toFixed(2)] }), _jsxs(View, { className: "flex flex-row items-center gap-1", children: [_jsx(Clock, { size: 10, color: "#64748b" }), _jsx(Text, { className: "block text-xs text-slate-500", children: t.time })] })] })] }) }, t.id)))) }) }) }), _jsx(TabsContent, { value: "risk", className: "flex-1", children: _jsx(ScrollView, { scrollY: true, className: "flex-1 smooth-scroll hide-scrollbar", children: _jsxs(View, { className: "px-4 pb-20 gap-4 flex flex-col", children: [_jsx(Card, { className: "bg-slate-800 border-slate-700 mt-3", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center gap-2 mb-3", children: [_jsx(Shield, { size: 16, color: "#3b82f6" }), _jsx(Text, { className: "block text-sm font-semibold text-slate-100", children: "\u98CE\u63A7\u6982\u89C8" })] }), _jsxs(View, { className: "flex flex-row gap-2", children: [_jsxs(View, { className: "flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-3", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u6700\u5927\u56DE\u64A4" }), _jsxs(Text, { className: "block text-lg font-bold text-amber-500 tabular-nums", children: [risk.maxDrawdown, "%"] })] }), _jsxs(View, { className: "flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-3", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u6B62\u635F\u7EBF" }), _jsxs(Text, { className: "block text-lg font-bold text-red-500 tabular-nums", children: [risk.stopLossRate, "%"] })] }), _jsxs(View, { className: "flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-3", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u6B62\u76C8\u7EBF" }), _jsxs(Text, { className: "block text-lg font-bold text-green-500 tabular-nums", children: [risk.takeProfitRate, "%"] })] })] })] }) }), _jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-4", children: [_jsx(Text, { className: "block text-sm font-semibold text-slate-100 mb-3", children: "\u98CE\u63A7\u53C2\u6570\u8BBE\u7F6E" }), _jsxs(View, { className: "flex flex-col gap-3", children: [_jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-sm text-slate-100", children: "\u6B62\u635F\u6BD4\u4F8B" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u5355\u7B14\u4E8F\u635F\u8D85\u8FC7\u6B64\u6BD4\u4F8B\u81EA\u52A8\u5E73\u4ED3" })] }), _jsxs(Badge, { className: "bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30 tabular-nums", children: [risk.stopLossRate, "%"] })] }), _jsx(Separator, { className: "bg-slate-700" }), _jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-sm text-slate-100", children: "\u6B62\u76C8\u6BD4\u4F8B" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u5355\u7B14\u76C8\u5229\u8FBE\u5230\u6B64\u6BD4\u4F8B\u81EA\u52A8\u6B62\u76C8" })] }), _jsxs(Badge, { className: "bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30 tabular-nums", children: [risk.takeProfitRate, "%"] })] }), _jsx(Separator, { className: "bg-slate-700" }), _jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-sm text-slate-100", children: "\u6700\u5927\u4ED3\u4F4D\u5360\u6BD4" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u5355\u4E2A\u5E01\u79CD\u6700\u5927\u6301\u4ED3\u5360\u603B\u8D44\u4EA7\u6BD4\u4F8B" })] }), _jsxs(Badge, { className: "bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30 tabular-nums", children: [risk.maxPositionRate, "%"] })] }), _jsx(Separator, { className: "bg-slate-700" }), _jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-sm text-slate-100", children: "\u6BCF\u65E5\u4EA4\u6613\u4E0A\u9650" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "Agent \u6BCF\u65E5\u6700\u5927\u4EA4\u6613\u6B21\u6570" })] }), _jsxs(Badge, { className: "bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30 tabular-nums", children: [risk.dailyTradeLimit, " \u6B21"] })] })] })] }) }), _jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsx(CardContent, { className: "p-4", children: _jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Bell, { size: 16, color: "#f59e0b" }), _jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-sm text-slate-100", children: "\u4EA4\u6613\u901A\u77E5" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "Agent \u6267\u884C\u4EA4\u6613\u65F6\u63A8\u9001\u901A\u77E5" })] })] }), _jsx(Switch, { checked: notifyEnabled, onCheckedChange: setNotifyEnabled })] }) }) }), _jsx(Card, { className: "bg-amber-500 bg-opacity-10 border-amber-500 border-opacity-30", children: _jsx(CardContent, { className: "p-4", children: _jsxs(View, { className: "flex flex-row items-start gap-2", children: [_jsx(TriangleAlert, { size: 16, color: "#f59e0b" }), _jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-sm font-medium text-amber-400", children: "\u98CE\u9669\u63D0\u793A" }), _jsx(Text, { className: "block text-xs text-slate-400", children: "\u91CF\u5316\u4EA4\u6613\u5B58\u5728\u98CE\u9669\uFF0C\u8FC7\u5F80\u6536\u76CA\u4E0D\u4EE3\u8868\u672A\u6765\u8868\u73B0\u3002\u8BF7\u6839\u636E\u81EA\u8EAB\u98CE\u9669\u627F\u53D7\u80FD\u529B\u5408\u7406\u914D\u7F6E\u8D44\u91D1\uFF0C\u8BBE\u7F6E\u597D\u6B62\u635F\u53C2\u6570\u3002" })] })] }) }) }), _jsx(Button, { className: "bg-emerald-500 text-white", onClick: saveRiskSettings, children: _jsx(Text, { className: "text-sm font-medium", children: "\u4FDD\u5B58\u98CE\u63A7\u8BBE\u7F6E" }) })] }) }) })] }), _jsx(Card, { className: "bg-slate-800 border-slate-700 rounded-xl mt-1 mb-6", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center gap-3", children: [_jsx(View, { className: "w-9 h-9 rounded-lg bg-red-500 bg-opacity-20 flex items-center justify-center", children: _jsx(RotateCcw, { size: 18, color: "#f87171" }) }), _jsxs(View, { className: "flex-1", children: [_jsx(Text, { className: "block text-sm font-medium text-slate-100", children: "\u91CD\u7F6E\u5185\u6D4B\u6570\u636E" }), _jsx(Text, { className: "block text-xs text-slate-400 mt-1", children: "\u6E05\u7A7A\u5173\u6CE8\u3001\u7B56\u7565\u3001\u8D26\u6237\u4E0E\u901A\u77E5\uFF0C\u56DE\u5230\u4ECE\u96F6\u914D\u7F6E\u72B6\u6001" })] })] }), _jsxs(AlertDialog, { open: resetOpen, onOpenChange: setResetOpen, children: [_jsx(AlertDialogTrigger, { children: _jsx(Button, { className: "w-full mt-3 bg-red-500 text-white", variant: "destructive", children: _jsx(Text, { className: "text-sm font-medium", children: "\u4ECE\u96F6\u91CD\u7F6E" }) }) }), _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u786E\u8BA4\u91CD\u7F6E\u5168\u90E8\u5185\u6D4B\u6570\u636E\uFF1F" }), _jsx(AlertDialogDescription, { children: "\u5C06\u6E05\u7A7A\u6295\u5165\u91D1\u989D\u3001\u5173\u6CE8\u80A1\u7968\u3001\u81EA\u5B9A\u4E49\u7B56\u7565\u3001\u6A21\u62DF\u8D26\u6237\u4E0E\u5168\u90E8\u901A\u77E5\uFF0C\u56DE\u5230\u9996\u6B21\u4F7F\u7528\u7684\u4ECE\u96F6\u914D\u7F6E\u72B6\u6001\u3002\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002" })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: _jsx(Text, { className: "text-sm", children: "\u53D6\u6D88" }) }), _jsx(AlertDialogAction, { onClick: handleResetAll, children: _jsx(Text, { className: "text-sm text-red-400", children: "\u786E\u8BA4\u91CD\u7F6E" }) })] })] })] })] }) })] }));
};
export default ProfilePage;
//# sourceMappingURL=index.js.map