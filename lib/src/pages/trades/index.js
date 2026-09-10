import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowUpRight, ArrowDownLeft, ChartBar, ListFilter } from 'lucide-react-taro';
const FILTER_TABS = [
    { key: 'all', label: '全部' },
    { key: 'BUY', label: '买入' },
    { key: 'SELL', label: '卖出' },
];
export default function TradesPage() {
    const [activeFilter, setActiveFilter] = useState('all');
    const [trades, setTrades] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const loadData = useCallback(async () => {
        var _a, _b, _c, _d;
        setLoading(true);
        try {
            const [tradeRes, sumRes] = await Promise.all([
                Network.request({
                    url: activeFilter === 'all' ? '/api/paper-trading/trades' : `/api/paper-trading/trades?type=${activeFilter}`,
                }),
                Network.request({ url: '/api/paper-trading/summary' }),
            ]);
            setTrades(Array.isArray((_b = (_a = tradeRes.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.list) ? tradeRes.data.data.list : []);
            setSummary((_d = (_c = sumRes.data) === null || _c === void 0 ? void 0 : _c.data) !== null && _d !== void 0 ? _d : null);
        }
        catch (e) {
            console.error('[trades] load error', e);
        }
        finally {
            setLoading(false);
        }
    }, [activeFilter]);
    useEffect(() => {
        loadData();
    }, [loadData]);
    const fmtMoney = (n) => (n >= 0 ? '' : '-') + '¥' + Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtTime = (ts) => {
        const d = new Date(ts);
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    const isUp = (trade) => trade.type === 'SELL';
    return (_jsx(View, { className: "flex flex-col h-full bg-slate-900 smooth-scroll", children: _jsxs(ScrollView, { scrollY: true, className: "flex-1 px-4 pt-3 pb-6", refresherEnabled: true, refresherTriggered: loading, onRefresherRefresh: loadData, children: [summary && (_jsx(Card, { className: "bg-slate-800 border-slate-700 rounded-xl mb-4", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center gap-2 mb-3", children: [_jsx(ChartBar, { size: 16, color: "#94a3b8" }), _jsx(Text, { className: "block text-sm font-medium text-slate-300", children: "\u4EA4\u6613\u6C47\u603B" })] }), _jsxs(View, { className: "grid grid-cols-3 gap-2", children: [_jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u4EA4\u6613\u7B14\u6570" }), _jsx(Text, { className: "block text-lg font-bold text-white tabular-nums mt-1", children: summary.totalTrades })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u4E70\u5165" }), _jsxs(Text, { className: "block text-base font-semibold text-emerald-400 tabular-nums mt-1", children: [summary.buyCount, "\u7B14"] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u5356\u51FA" }), _jsxs(Text, { className: "block text-base font-semibold text-red-400 tabular-nums mt-1", children: [summary.sellCount, "\u7B14"] })] })] }), _jsx(Separator, { className: "my-3 bg-slate-700" }), _jsxs(View, { className: "flex flex-row justify-between", children: [_jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u7D2F\u8BA1\u4E70\u5165" }), _jsx(Text, { className: "block text-sm font-medium text-slate-200 tabular-nums mt-1", children: fmtMoney(summary.totalBuyAmount) })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u7D2F\u8BA1\u5356\u51FA" }), _jsx(Text, { className: "block text-sm font-medium text-slate-200 tabular-nums mt-1", children: fmtMoney(summary.totalSellAmount) })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u5DF2\u5B9E\u73B0\u76C8\u4E8F" }), _jsx(Text, { className: `block text-sm font-semibold tabular-nums mt-1 ${summary.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`, children: fmtMoney(summary.realizedPnl) })] })] })] }) })), _jsxs(View, { className: "flex flex-row items-center gap-2 mb-3", children: [_jsx(ListFilter, { size: 14, color: "#94a3b8" }), _jsx(View, { className: "flex flex-row gap-2", children: FILTER_TABS.map((tab) => (_jsx(View, { className: `px-3 py-2 rounded-full text-xs font-medium transition-colors ${activeFilter === tab.key
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-800 text-slate-400'}`, onClick: () => setActiveFilter(tab.key), children: _jsx(Text, { className: "block", children: tab.label }) }, tab.key))) })] }), trades.length === 0 && !loading && (_jsx(View, { className: "flex flex-col items-center justify-center py-16", children: _jsx(Text, { className: "block text-slate-500 text-sm", children: "\u6682\u65E0\u4EA4\u6613\u8BB0\u5F55" }) })), _jsx(View, { className: "flex flex-col gap-2", children: trades.map((trade) => (_jsx(Card, { className: "bg-slate-800 border-slate-700 rounded-xl", children: _jsxs(CardContent, { className: "p-3", children: [_jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(View, { className: `w-8 h-8 rounded-full flex items-center justify-center ${isUp(trade) ? 'bg-red-500 bg-opacity-20' : 'bg-emerald-500 bg-opacity-20'}`, children: isUp(trade) ? (_jsx(ArrowUpRight, { size: 14, color: "#f87171" })) : (_jsx(ArrowDownLeft, { size: 14, color: "#34d399" })) }), _jsxs(View, { children: [_jsx(Text, { className: "block text-sm font-medium text-white", children: trade.name }), _jsxs(Text, { className: "block text-xs text-slate-400 mt-1 tabular-nums", children: [trade.symbol, " \u00B7 ", fmtTime(trade.timestamp)] })] })] }), _jsxs(View, { className: "text-right", children: [_jsxs(Text, { className: `block text-sm font-bold tabular-nums ${isUp(trade) ? 'text-red-400' : 'text-emerald-400'}`, children: [trade.type === 'BUY' ? '+' : '-', trade.quantity, "\u80A1"] }), _jsxs(Text, { className: "block text-xs text-slate-400 mt-1 tabular-nums", children: ["\u00A5", trade.price.toFixed(2)] })] })] }), _jsx(Separator, { className: "my-2 bg-slate-700" }), _jsxs(View, { className: "flex flex-row justify-between items-center", children: [_jsx(Badge, { className: trade.type === 'BUY' ? 'bg-emerald-500 bg-opacity-20 text-emerald-400' : 'bg-red-500 bg-opacity-20 text-red-400', children: trade.type === 'BUY' ? '买入' : '卖出' }), _jsxs(View, { className: "text-right", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6210\u4EA4\u989D" }), _jsx(Text, { className: "block text-sm font-semibold text-white tabular-nums", children: fmtMoney(trade.amount) })] })] }), trade.reason && trade.reason !== trade.type && (_jsxs(Text, { className: "block text-xs text-slate-500 mt-2", children: ["\u539F\u56E0\uFF1A", trade.reason] }))] }) }, trade.id))) })] }) }));
}
//# sourceMappingURL=index.js.map