import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Network } from '@/network';
import { Play, Pause, RotateCcw, Wallet, TrendingUp, TrendingDown, Activity } from 'lucide-react-taro';
export default function PaperTradingPage() {
    const [account, setAccount] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('positions');
    const fetchAccount = async () => {
        var _a;
        try {
            const res = await Network.request({
                url: '/api/paper-trading/account',
            });
            console.log('模拟交易账户:', res.data);
            setAccount(((_a = res.data) === null || _a === void 0 ? void 0 : _a.data) || null);
        }
        catch (error) {
            console.error('获取账户失败:', error);
        }
    };
    useEffect(() => {
        fetchAccount();
    }, []);
    const handleStart = async () => {
        setLoading(true);
        try {
            await Network.request({
                url: '/api/paper-trading/start',
                method: 'POST',
                data: { strategyIds: ['momentum', 'mean-reversion'] },
            });
            Taro.showToast({ title: '模拟交易已启动', icon: 'success' });
            fetchAccount();
        }
        catch (error) {
            console.error('启动失败:', error);
            Taro.showToast({ title: '启动失败', icon: 'error' });
        }
        finally {
            setLoading(false);
        }
    };
    const handleStop = async () => {
        setLoading(true);
        try {
            await Network.request({
                url: '/api/paper-trading/stop',
                method: 'POST',
                data: {},
            });
            Taro.showToast({ title: '模拟交易已停止', icon: 'success' });
            fetchAccount();
        }
        catch (error) {
            console.error('停止失败:', error);
            Taro.showToast({ title: '停止失败', icon: 'error' });
        }
        finally {
            setLoading(false);
        }
    };
    const handleReset = async () => {
        Taro.showModal({
            title: '确认重置',
            content: '重置将清空所有持仓和交易记录，恢复初始资金。',
            success: async (res) => {
                if (res.confirm) {
                    setLoading(true);
                    try {
                        await Network.request({
                            url: '/api/paper-trading/reset',
                            method: 'POST',
                            data: { initialCapital: 100000 },
                        });
                        Taro.showToast({ title: '已重置', icon: 'success' });
                        fetchAccount();
                    }
                    catch (error) {
                        console.error('重置失败:', error);
                        Taro.showToast({ title: '重置失败', icon: 'error' });
                    }
                    finally {
                        setLoading(false);
                    }
                }
            },
        });
    };
    const handleSimulate = async () => {
        var _a;
        setLoading(true);
        try {
            const res = await Network.request({
                url: '/api/paper-trading/simulate',
                method: 'POST',
                data: {},
            });
            const data = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            if ((data === null || data === void 0 ? void 0 : data.executed) > 0) {
                Taro.showToast({ title: `执行了 ${data.executed} 笔交易`, icon: 'success' });
            }
            else {
                Taro.showToast({ title: '暂无交易信号', icon: 'none' });
            }
            fetchAccount();
        }
        catch (error) {
            console.error('模拟失败:', error);
            Taro.showToast({ title: '模拟失败', icon: 'error' });
        }
        finally {
            setLoading(false);
        }
    };
    if (!account) {
        return (_jsx(View, { className: "flex items-center justify-center h-full bg-slate-900", children: _jsx(Text, { className: "block text-slate-400", children: "\u52A0\u8F7D\u4E2D..." }) }));
    }
    return (_jsx(ScrollView, { scrollY: true, className: "h-full bg-slate-900", children: _jsxs(View, { className: "p-4 pb-20", children: [_jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs(View, { className: "flex items-center justify-between", children: [_jsxs(CardTitle, { className: "text-slate-100 text-base flex items-center gap-2", children: [_jsx(Wallet, { size: 18, color: "#10b981" }), _jsx(Text, { className: "block", children: "\u6A21\u62DF\u4EA4\u6613\u8D26\u6237" })] }), _jsx(Badge, { variant: account.isRunning ? 'default' : 'outline', className: account.isRunning ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30' : 'border-slate-600 text-slate-400', children: _jsxs(View, { className: "flex items-center gap-1", children: [account.isRunning && _jsx(Activity, { size: 12, color: "#22c55e" }), _jsx(Text, { className: "block text-xs", children: account.isRunning ? '运行中' : '已停止' })] }) })] }) }), _jsxs(CardContent, { children: [_jsxs(View, { className: "grid grid-cols-2 gap-4 mb-4", children: [_jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u603B\u8D44\u4EA7" }), _jsxs(Text, { className: "block text-xl font-bold text-slate-100", children: ["\u00A5", account.totalValue.toLocaleString()] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u603B\u6536\u76CA" }), _jsxs(View, { className: "flex items-center gap-1", children: [account.totalPnl > 0 ? (_jsx(TrendingUp, { size: 14, color: "#22c55e" })) : account.totalPnl < 0 ? (_jsx(TrendingDown, { size: 14, color: "#ef4444" })) : null, _jsxs(Text, { className: `block text-xl font-bold ${account.totalPnl > 0 ? 'text-green-500' : account.totalPnl < 0 ? 'text-red-500' : 'text-slate-400'}`, children: [account.totalPnl > 0 ? '+' : '', account.totalPnlRate, "%"] })] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u53EF\u7528\u8D44\u91D1" }), _jsxs(Text, { className: "block text-base font-bold text-slate-100", children: ["\u00A5", account.cash.toLocaleString()] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6301\u4ED3\u5E02\u503C" }), _jsxs(Text, { className: "block text-base font-bold text-slate-100", children: ["\u00A5", (account.totalValue - account.cash).toLocaleString()] })] })] }), _jsxs(View, { className: "flex gap-2", children: [account.isRunning ? (_jsxs(Button, { variant: "destructive", className: "flex-1 bg-red-500 bg-opacity-20 text-red-400 border border-red-500 border-opacity-30", onClick: handleStop, disabled: loading, children: [_jsx(Pause, { size: 16, className: "mr-1", color: "#ef4444" }), _jsx(Text, { className: "block text-sm", children: "\u505C\u6B62" })] })) : (_jsxs(Button, { className: "flex-1 bg-green-500 text-white", onClick: handleStart, disabled: loading, children: [_jsx(Play, { size: 16, className: "mr-1", color: "#ffffff" }), _jsx(Text, { className: "block text-sm", children: "\u542F\u52A8" })] })), _jsx(Button, { variant: "outline", className: "border-slate-600 text-slate-300", onClick: handleSimulate, disabled: loading || !account.isRunning, children: _jsx(Text, { className: "block text-sm", children: "\u6A21\u62DF\u4E00\u6B21" }) }), _jsx(Button, { variant: "outline", className: "border-slate-600 text-slate-300", onClick: handleReset, disabled: loading, children: _jsx(RotateCcw, { size: 14, color: "#94a3b8" }) })] })] })] }), _jsxs(View, { className: "flex gap-2 mb-4", children: [_jsx(Badge, { variant: activeTab === 'positions' ? 'default' : 'outline', className: `cursor-pointer ${activeTab === 'positions'
                                ? 'bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-30'
                                : 'border-slate-600 text-slate-400'}`, onClick: () => setActiveTab('positions'), children: _jsxs(Text, { className: "block text-sm", children: ["\u6301\u4ED3 (", account.positions.length, ")"] }) }), _jsx(Badge, { variant: activeTab === 'trades' ? 'default' : 'outline', className: `cursor-pointer ${activeTab === 'trades'
                                ? 'bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-30'
                                : 'border-slate-600 text-slate-400'}`, onClick: () => setActiveTab('trades'), children: _jsxs(Text, { className: "block text-sm", children: ["\u4EA4\u6613\u8BB0\u5F55 (", account.trades.length, ")"] }) })] }), activeTab === 'positions' && (_jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsx(CardContent, { className: "p-0", children: account.positions.length === 0 ? (_jsxs(View, { className: "py-8 text-center", children: [_jsx(Text, { className: "block text-slate-400 text-sm", children: "\u6682\u65E0\u6301\u4ED3" }), _jsx(Text, { className: "block text-slate-500 text-xs mt-1", children: "\u542F\u52A8\u6A21\u62DF\u4EA4\u6613\u540E\uFF0CAgent \u5C06\u81EA\u52A8\u6267\u884C\u4EA4\u6613" })] })) : (account.positions.map((pos, idx) => (_jsxs(View, { children: [_jsxs(View, { className: "p-4", children: [_jsxs(View, { className: "flex items-center justify-between mb-2", children: [_jsxs(View, { children: [_jsx(Text, { className: "block text-sm font-medium text-slate-100", children: pos.name }), _jsx(Text, { className: "block text-xs text-slate-400", children: pos.symbol })] }), _jsxs(View, { className: "text-right", children: [_jsxs(Text, { className: "block text-sm font-medium text-slate-100", children: ["\u00A5", pos.marketValue.toLocaleString()] }), _jsxs(View, { className: "flex items-center gap-1 justify-end", children: [pos.pnl > 0 ? (_jsx(TrendingUp, { size: 12, color: "#22c55e" })) : pos.pnl < 0 ? (_jsx(TrendingDown, { size: 12, color: "#ef4444" })) : null, _jsxs(Text, { className: `block text-xs ${pos.pnl > 0 ? 'text-green-500' : pos.pnl < 0 ? 'text-red-500' : 'text-slate-400'}`, children: [pos.pnl > 0 ? '+' : '', pos.pnlRate, "%"] })] })] })] }), _jsxs(View, { className: "flex justify-between text-xs text-slate-400", children: [_jsxs(Text, { className: "block", children: [pos.quantity, "\u80A1 @ \u00A5", pos.avgCost] }), _jsxs(Text, { className: "block", children: ["\u76C8\u4E8F: ", pos.pnl > 0 ? '+' : '', "\u00A5", pos.pnl.toFixed(2)] })] })] }), idx < account.positions.length - 1 && _jsx(Separator, { className: "bg-slate-700" })] }, pos.symbol)))) }) })), activeTab === 'trades' && (_jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsx(CardContent, { className: "p-0", children: account.trades.length === 0 ? (_jsx(View, { className: "py-8 text-center", children: _jsx(Text, { className: "block text-slate-400 text-sm", children: "\u6682\u65E0\u4EA4\u6613\u8BB0\u5F55" }) })) : (account.trades.slice().reverse().map((trade, idx) => (_jsxs(View, { children: [_jsxs(View, { className: "p-4", children: [_jsxs(View, { className: "flex items-center justify-between mb-1", children: [_jsxs(View, { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: trade.type === 'BUY' ? 'default' : 'destructive', className: trade.type === 'BUY' ? 'bg-green-500 bg-opacity-20 text-green-400' : 'bg-red-500 bg-opacity-20 text-red-400', children: _jsx(Text, { className: "block text-xs", children: trade.type === 'BUY' ? '买入' : '卖出' }) }), _jsx(Text, { className: "block text-sm text-slate-100", children: trade.name })] }), _jsxs(Text, { className: "block text-xs text-slate-400", children: [trade.date, " ", trade.time] })] }), _jsxs(View, { className: "flex justify-between text-xs text-slate-400", children: [_jsxs(Text, { className: "block", children: ["\u00A5", trade.price, " x ", trade.quantity, "\u80A1"] }), _jsxs(Text, { className: "block", children: ["\u91D1\u989D: \u00A5", trade.amount.toLocaleString()] })] }), _jsx(Text, { className: "block text-xs text-slate-500 mt-1", children: trade.reason })] }), idx < account.trades.length - 1 && _jsx(Separator, { className: "bg-slate-700" })] }, trade.id)))) }) }))] }) }));
}
//# sourceMappingURL=index.js.map