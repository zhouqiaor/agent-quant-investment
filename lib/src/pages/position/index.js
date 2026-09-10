import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { CandleChart } from '@/components/chart/candle-chart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, DollarSign, ChartPie } from 'lucide-react-taro';
export default function PositionPage() {
    var _a, _b, _c, _d, _e, _f;
    const router = useRouter();
    const symbol = router.params.symbol || '600519';
    const name = router.params.name || '';
    const [position, setPosition] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showSellSheet, setShowSellSheet] = useState(false);
    const [sellQty, setSellQty] = useState('');
    const [sellPrice, setSellPrice] = useState('');
    const [showBuySheet, setShowBuySheet] = useState(false);
    const [buyQty, setBuyQty] = useState('');
    const [buyPrice, setBuyPrice] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [kline, setKline] = useState([]);
    const [klinePeriod, setKlinePeriod] = useState('30');
    const loadKline = useCallback(async () => {
        var _a;
        try {
            const res = await Network.request({
                url: '/api/stock/kline',
                data: { symbol, period: 'daily', limit: klinePeriod },
            });
            const list = ((_a = res.data) === null || _a === void 0 ? void 0 : _a.data) || [];
            // 最近 N 根
            setKline(list.slice(-parseInt(klinePeriod)));
        }
        catch (e) {
            console.error('[position] kline error', e);
            setKline([]);
        }
    }, [symbol, klinePeriod]);
    const loadPosition = useCallback(async () => {
        var _a, _b;
        setLoading(true);
        try {
            const res = await Network.request({
                url: `/api/paper-trading/position/${encodeURIComponent(symbol)}`,
            });
            setPosition((_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : null);
        }
        catch (e) {
            console.error('[position] load error', e);
        }
        finally {
            setLoading(false);
        }
    }, [symbol]);
    useEffect(() => {
        loadPosition();
        loadKline();
    }, [loadPosition, loadKline]);
    const fmtMoney = (n) => (n >= 0 ? '' : '-') + '¥' + Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtPct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    const handleBuy = async () => {
        var _a, _b;
        const qty = parseInt(buyQty);
        const price = parseFloat(buyPrice);
        if (!qty || qty <= 0)
            return Taro.showToast({ title: '请输入数量', icon: 'none' });
        if (!price || price <= 0)
            return Taro.showToast({ title: '请输入价格', icon: 'none' });
        setSubmitting(true);
        try {
            const res = await Network.request({
                url: '/api/paper-trading/manual/buy',
                method: 'POST',
                data: { symbol, name: (position === null || position === void 0 ? void 0 : position.name) || name, price, quantity: qty, reason: '手动买入' },
            });
            if (((_a = res.data) === null || _a === void 0 ? void 0 : _a.code) === 200) {
                Taro.showToast({ title: '买入成功', icon: 'success' });
                setShowBuySheet(false);
                setBuyQty('');
                setBuyPrice('');
                loadPosition();
            }
            else {
                Taro.showToast({ title: ((_b = res.data) === null || _b === void 0 ? void 0 : _b.msg) || '买入失败', icon: 'none' });
            }
        }
        catch (e) {
            Taro.showToast({ title: '买入失败', icon: 'none' });
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleSell = async () => {
        var _a, _b;
        const qty = sellQty === '' ? (position === null || position === void 0 ? void 0 : position.quantity) || 0 : parseInt(sellQty);
        const price = parseFloat(sellPrice);
        if (!qty || qty <= 0)
            return Taro.showToast({ title: '请输入数量', icon: 'none' });
        if (!price || price <= 0)
            return Taro.showToast({ title: '请输入价格', icon: 'none' });
        if (position && qty > position.quantity) {
            return Taro.showToast({ title: '超出持仓数量', icon: 'none' });
        }
        setSubmitting(true);
        try {
            const res = await Network.request({
                url: '/api/paper-trading/manual/sell',
                method: 'POST',
                data: { symbol, price, quantity: qty, reason: '手动卖出' },
            });
            if (((_a = res.data) === null || _a === void 0 ? void 0 : _a.code) === 200) {
                Taro.showToast({ title: '卖出成功', icon: 'success' });
                setShowSellSheet(false);
                setSellQty('');
                setSellPrice('');
                loadPosition();
            }
            else {
                Taro.showToast({ title: ((_b = res.data) === null || _b === void 0 ? void 0 : _b.msg) || '卖出失败', icon: 'none' });
            }
        }
        catch (e) {
            Taro.showToast({ title: '卖出失败', icon: 'none' });
        }
        finally {
            setSubmitting(false);
        }
    };
    const isProfit = ((_a = position === null || position === void 0 ? void 0 : position.pnl) !== null && _a !== void 0 ? _a : 0) >= 0;
    if (!position && !loading) {
        return (_jsx(View, { className: "flex flex-col items-center justify-center h-full bg-slate-900", children: _jsx(Text, { className: "block text-slate-500 text-sm", children: "\u6682\u65E0\u8BE5\u6301\u4ED3" }) }));
    }
    return (_jsxs(View, { className: "flex flex-col h-full bg-slate-900", children: [_jsxs(ScrollView, { scrollY: true, className: "flex-1 px-4 py-4 smooth-scroll", children: [_jsx(Card, { className: "bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 rounded-2xl mb-4", children: _jsxs(CardContent, { className: "p-5", children: [_jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { children: [_jsx(Text, { className: "block text-lg font-bold text-white", children: (position === null || position === void 0 ? void 0 : position.name) || name }), _jsx(Text, { className: "block text-xs text-slate-400 mt-1 tabular-nums", children: symbol })] }), _jsx(Badge, { className: isProfit ? 'bg-emerald-500 bg-opacity-20 text-emerald-400' : 'bg-red-500 bg-opacity-20 text-red-400', children: isProfit ? '盈利中' : '亏损中' })] }), _jsxs(View, { className: "mt-5", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6D6E\u52A8\u76C8\u4E8F" }), _jsxs(View, { className: "flex flex-row items-baseline gap-2 mt-1", children: [_jsx(Text, { className: `block text-3xl font-bold tabular-nums ${isProfit ? 'text-emerald-400' : 'text-red-400'}`, children: fmtMoney((_b = position === null || position === void 0 ? void 0 : position.pnl) !== null && _b !== void 0 ? _b : 0) }), _jsx(Text, { className: `block text-base font-semibold tabular-nums ${isProfit ? 'text-emerald-400' : 'text-red-400'}`, children: fmtPct((_c = position === null || position === void 0 ? void 0 : position.pnlRate) !== null && _c !== void 0 ? _c : 0) })] })] }), _jsx(Separator, { className: "my-4 bg-slate-700" }), _jsxs(View, { className: "grid grid-cols-2 gap-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(DollarSign, { size: 14, color: "#94a3b8" }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u5F53\u524D\u4EF7" }), _jsxs(Text, { className: "block text-sm font-medium text-white tabular-nums mt-1", children: ["\u00A5", ((_d = position === null || position === void 0 ? void 0 : position.currentPrice) === null || _d === void 0 ? void 0 : _d.toFixed(2)) || '--'] })] })] }), _jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(ChartPie, { size: 14, color: "#94a3b8" }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6210\u672C\u4EF7" }), _jsxs(Text, { className: "block text-sm font-medium text-white tabular-nums mt-1", children: ["\u00A5", ((_e = position === null || position === void 0 ? void 0 : position.avgCost) === null || _e === void 0 ? void 0 : _e.toFixed(2)) || '--'] })] })] }), _jsxs(View, { className: "flex flex-row items-center gap-2", children: [isProfit ? _jsx(TrendingUp, { size: 14, color: "#34d399" }) : _jsx(TrendingDown, { size: 14, color: "#f87171" }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u5E02\u503C" }), _jsx(Text, { className: "block text-sm font-medium text-white tabular-nums mt-1", children: fmtMoney((_f = position === null || position === void 0 ? void 0 : position.marketValue) !== null && _f !== void 0 ? _f : 0) })] })] }), _jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(ChartPie, { size: 14, color: "#94a3b8" }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6301\u4ED3" }), _jsxs(Text, { className: "block text-sm font-medium text-white tabular-nums mt-1", children: [(position === null || position === void 0 ? void 0 : position.quantity) || 0, " \u80A1"] })] })] })] })] }) }), _jsx(Card, { className: "bg-slate-800 border-slate-700 rounded-2xl mb-4", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center justify-between mb-3", children: [_jsx(Text, { className: "block text-sm font-medium text-white", children: "\u65E5K\u8D70\u52BF" }), _jsx(View, { className: "flex flex-row gap-1", children: ['30', '60', '120'].map((p) => (_jsxs(Badge, { className: `${klinePeriod === p
                                                    ? 'bg-emerald-500 text-white border-emerald-500'
                                                    : 'bg-slate-700 text-slate-400 border-slate-600'}`, onClick: () => setKlinePeriod(p), children: [p, "\u65E5"] }, p))) })] }), kline.length > 0 ? (_jsx(CandleChart
                                // @ts-expect-error 数据字段类型兼容
                                , { 
                                    // @ts-expect-error 数据字段类型兼容
                                    data: kline.map((k) => {
                                        var _a, _b;
                                        return ({
                                            time: ((_a = k.date) === null || _a === void 0 ? void 0 : _a.slice(5)) || ((_b = k.day) === null || _b === void 0 ? void 0 : _b.slice(5)) || '',
                                            open: parseFloat(k.open),
                                            high: parseFloat(k.high),
                                            low: parseFloat(k.low),
                                            close: parseFloat(k.close),
                                        });
                                    }), costPrice: position === null || position === void 0 ? void 0 : position.avgCost, height: 220 })) : (_jsx(View, { className: "flex items-center justify-center h-48", children: _jsx(Text, { className: "block text-xs text-slate-500", children: "\u6682\u65E0K\u7EBF\u6570\u636E" }) }))] }) }), _jsxs(View, { className: "flex flex-row gap-3 mb-4", children: [_jsx(Button, { className: "flex-1 h-10 bg-emerald-500 text-white", onClick: () => {
                                    setBuyPrice(String((position === null || position === void 0 ? void 0 : position.currentPrice) || ''));
                                    setShowBuySheet(true);
                                }, children: _jsx(Text, { className: "text-sm font-medium", children: "\u4E70\u5165" }) }), _jsx(Button, { className: "flex-1 h-10 bg-red-500 text-white", onClick: () => {
                                    setSellPrice(String((position === null || position === void 0 ? void 0 : position.currentPrice) || ''));
                                    setShowSellSheet(true);
                                }, children: _jsx(Text, { className: "text-sm font-medium", children: "\u5356\u51FA" }) })] }), _jsx(Card, { className: "bg-slate-800 border-slate-700 rounded-xl", onClick: () => Taro.navigateTo({ url: `/pages/trades/index?symbol=${symbol}` }), children: _jsx(CardContent, { className: "p-4", children: _jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsx(Text, { className: "block text-sm font-medium text-white", children: "\u67E5\u770B\u4EA4\u6613\u8BB0\u5F55" }), _jsx(Text, { className: "block text-xs text-slate-400", children: "\u2192" })] }) }) })] }), showBuySheet && (_jsx(View, { className: "fixed inset-0 bg-black bg-opacity-60 z-50 flex flex-col justify-end", onClick: () => setShowBuySheet(false), children: _jsxs(View, { className: "bg-slate-800 rounded-t-2xl p-5", onClick: (e) => e.stopPropagation(), children: [_jsx(Text, { className: "block text-lg font-bold text-white mb-4", children: "\u624B\u52A8\u4E70\u5165" }), _jsxs(View, { className: "bg-slate-900 rounded-xl px-4 py-3 mb-3", children: [_jsx(Text, { className: "block text-xs text-slate-400 mb-1", children: "\u4E70\u5165\u4EF7\u683C\uFF08\u5143\uFF09" }), _jsx("input", { className: "w-full bg-transparent text-white text-base font-medium outline-none tabular-nums", placeholder: "\u8BF7\u8F93\u5165\u4EF7\u683C", value: buyPrice, onInput: (e) => setBuyPrice(e.target.value), type: "number", step: "0.01" })] }), _jsxs(View, { className: "bg-slate-900 rounded-xl px-4 py-3 mb-4", children: [_jsx(Text, { className: "block text-xs text-slate-400 mb-1", children: "\u4E70\u5165\u6570\u91CF\uFF08\u80A1\uFF09" }), _jsx("input", { className: "w-full bg-transparent text-white text-base font-medium outline-none tabular-nums", placeholder: "\u8BF7\u8F93\u5165\u6570\u91CF", value: buyQty, onInput: (e) => setBuyQty(e.target.value), type: "number" })] }), _jsx(Button, { className: "w-full h-11 bg-emerald-500 text-white", onClick: handleBuy, disabled: submitting, children: _jsx(Text, { className: "text-sm font-medium", children: submitting ? '提交中...' : '确认买入' }) })] }) })), showSellSheet && (_jsx(View, { className: "fixed inset-0 bg-black bg-opacity-60 z-50 flex flex-col justify-end", onClick: () => setShowSellSheet(false), children: _jsxs(View, { className: "bg-slate-800 rounded-t-2xl p-5", onClick: (e) => e.stopPropagation(), children: [_jsx(Text, { className: "block text-lg font-bold text-white mb-2", children: "\u624B\u52A8\u5356\u51FA" }), _jsxs(Text, { className: "block text-xs text-slate-400 mb-4", children: ["\u53EF\u5356 ", (position === null || position === void 0 ? void 0 : position.quantity) || 0, " \u80A1"] }), _jsxs(View, { className: "bg-slate-900 rounded-xl px-4 py-3 mb-3", children: [_jsx(Text, { className: "block text-xs text-slate-400 mb-1", children: "\u5356\u51FA\u4EF7\u683C\uFF08\u5143\uFF09" }), _jsx("input", { className: "w-full bg-transparent text-white text-base font-medium outline-none tabular-nums", placeholder: "\u8BF7\u8F93\u5165\u4EF7\u683C", value: sellPrice, onInput: (e) => setSellPrice(e.target.value), type: "number", step: "0.01" })] }), _jsxs(View, { className: "bg-slate-900 rounded-xl px-4 py-3 mb-4", children: [_jsx(Text, { className: "block text-xs text-slate-400 mb-1", children: "\u5356\u51FA\u6570\u91CF\uFF08\u7559\u7A7A\u5168\u90E8\u5356\u51FA\uFF09" }), _jsx("input", { className: "w-full bg-transparent text-white text-base font-medium outline-none tabular-nums", placeholder: `可卖 ${(position === null || position === void 0 ? void 0 : position.quantity) || 0} 股`, value: sellQty, onInput: (e) => setSellQty(e.target.value), type: "number" })] }), _jsx(Button, { className: "w-full h-11 bg-red-500 text-white", onClick: handleSell, disabled: submitting, children: _jsx(Text, { className: "text-sm font-medium", children: submitting ? '提交中...' : '确认卖出' }) })] }) }))] }));
}
//# sourceMappingURL=index.js.map