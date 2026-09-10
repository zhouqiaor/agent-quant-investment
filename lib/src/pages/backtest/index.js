import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Network } from '@/network';
import { TrendingUp, TrendingDown, Play, Target, TriangleAlert, ChartBar, Globe, Database, CircleCheck, CircleAlert } from 'lucide-react-taro';
import { LineChart } from '@/components/chart/line-chart';
const STOCK_LIST = [
    { symbol: '600519', name: '贵州茅台' },
    { symbol: '300750', name: '宁德时代' },
    { symbol: '002594', name: '比亚迪' },
    { symbol: '601318', name: '中国平安' },
    { symbol: '000858', name: '五粮液' },
    { symbol: '600036', name: '招商银行' },
    { symbol: '000333', name: '美的集团' },
    { symbol: '600276', name: '恒瑞医药' },
];
export default function BacktestPage() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const [mode, setMode] = useState('portfolio');
    const [symbol, setSymbol] = useState('600519');
    const [startDate, setStartDate] = useState('2026-08-01');
    const [endDate, setEndDate] = useState('2026-09-01');
    const [initialCapital, setInitialCapital] = useState('100000');
    const [indicators, setIndicators] = useState(['MA', 'MACD']);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [portfolioResult, setPortfolioResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    // 收益曲线数据（净值基准，1.0 起）
    const equityPoints = useMemo(() => {
        var _a, _b;
        if (mode === 'portfolio' && ((_a = portfolioResult === null || portfolioResult === void 0 ? void 0 : portfolioResult.equityCurve) === null || _a === void 0 ? void 0 : _a.length)) {
            const initial = portfolioResult.meta.initialCapital;
            if (initial <= 0)
                return [];
            const trades = portfolioResult.trades || [];
            return portfolioResult.equityCurve.map(p => {
                const dayTrade = trades.find(t => t.date === p.date);
                return {
                    label: p.date.slice(5),
                    value: p.value / initial,
                    marker: dayTrade === null || dayTrade === void 0 ? void 0 : dayTrade.type,
                };
            });
        }
        if (!((_b = result === null || result === void 0 ? void 0 : result.equityCurve) === null || _b === void 0 ? void 0 : _b.length) || result.initialCapital <= 0)
            return [];
        const trades = result.trades || [];
        return result.equityCurve.map(p => {
            // 找当天是否有交易（用于标记买卖点，取当天第一笔）
            const dayTrade = trades.find(t => t.date === p.date);
            return {
                label: p.date.slice(5), // MM-DD
                value: p.value / result.initialCapital,
                marker: dayTrade === null || dayTrade === void 0 ? void 0 : dayTrade.type,
            };
        });
    }, [result, portfolioResult, mode]);
    // 回撤曲线（百分比）
    const drawdownPoints = useMemo(() => {
        var _a, _b;
        if (mode === 'portfolio' && ((_a = portfolioResult === null || portfolioResult === void 0 ? void 0 : portfolioResult.equityCurve) === null || _a === void 0 ? void 0 : _a.length)) {
            let peak = portfolioResult.equityCurve[0].value;
            return portfolioResult.equityCurve.map(p => {
                if (p.value > peak)
                    peak = p.value;
                const dd = peak > 0 ? ((peak - p.value) / peak) * 100 : 0;
                return {
                    label: p.date.slice(5),
                    value: -dd,
                };
            });
        }
        if (!((_b = result === null || result === void 0 ? void 0 : result.equityCurve) === null || _b === void 0 ? void 0 : _b.length))
            return [];
        return result.equityCurve.map(p => ({
            label: p.date.slice(5),
            value: -p.drawdown, // 画在零轴下方更直观，用负数
        }));
    }, [result, portfolioResult, mode]);
    const handleBacktest = async () => {
        var _a, _b, _c, _d, _e, _f, _g;
        if (mode === 'portfolio') {
            return handlePortfolioBacktest();
        }
        const capital = parseInt(initialCapital);
        if (!Number.isFinite(capital) || capital <= 0) {
            Taro.showToast({ title: '初始资金必须大于0', icon: 'none' });
            return;
        }
        if (capital > 1e9) {
            Taro.showToast({ title: '初始资金不能超过10亿', icon: 'none' });
            return;
        }
        const dateRe = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
            Taro.showToast({ title: '日期格式需为 YYYY-MM-DD', icon: 'none' });
            return;
        }
        if (startDate >= endDate) {
            Taro.showToast({ title: '开始日期需早于结束日期', icon: 'none' });
            return;
        }
        setLoading(true);
        setErrorMsg(null);
        try {
            const res = await Network.request({
                url: '/api/backtest/run',
                method: 'POST',
                data: {
                    symbol,
                    startDate,
                    endDate,
                    initialCapital: capital,
                    indicators,
                },
            });
            console.log('回测结果:', res.data);
            if ((_a = res.data) === null || _a === void 0 ? void 0 : _a.data) {
                setResult(res.data.data);
                setPortfolioResult(null);
                // 数据不足时给出额外提示
                if ((_b = res.data.data.meta) === null || _b === void 0 ? void 0 : _b.insufficient) {
                    Taro.showToast({
                        title: `数据不完整：${res.data.data.meta.actualDays}/${res.data.data.meta.expectedDays}天`,
                        icon: 'none',
                        duration: 2500,
                    });
                }
            }
            else {
                setErrorMsg(((_c = res.data) === null || _c === void 0 ? void 0 : _c.message) || ((_d = res.data) === null || _d === void 0 ? void 0 : _d.msg) || '回测失败');
                Taro.showToast({ title: ((_e = res.data) === null || _e === void 0 ? void 0 : _e.message) || ((_f = res.data) === null || _f === void 0 ? void 0 : _f.msg) || '回测失败', icon: 'none' });
            }
        }
        catch (error) {
            console.error('回测失败:', error);
            const msg = ((_g = error === null || error === void 0 ? void 0 : error.data) === null || _g === void 0 ? void 0 : _g.message) || (error === null || error === void 0 ? void 0 : error.message) || '回测失败';
            setErrorMsg(msg);
            Taro.showToast({ title: msg, icon: 'none', duration: 3000 });
        }
        finally {
            setLoading(false);
        }
    };
    const handlePortfolioBacktest = async () => {
        var _a, _b, _c, _d, _e, _f, _g;
        const capital = parseInt(initialCapital);
        if (!Number.isFinite(capital) || capital <= 0) {
            Taro.showToast({ title: '初始资金必须大于0', icon: 'none' });
            return;
        }
        const dateRe = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
            Taro.showToast({ title: '日期格式需为 YYYY-MM-DD', icon: 'none' });
            return;
        }
        if (startDate >= endDate) {
            Taro.showToast({ title: '开始日期需早于结束日期', icon: 'none' });
            return;
        }
        setLoading(true);
        setErrorMsg(null);
        try {
            const res = await Network.request({
                url: '/api/backtest/portfolio',
                method: 'POST',
                data: {
                    initialCapital: capital,
                    startDate,
                    endDate,
                    autoTrade: true,
                },
            });
            console.log('全局组合回测结果:', res.data);
            if ((_a = res.data) === null || _a === void 0 ? void 0 : _a.data) {
                setPortfolioResult(res.data.data);
                setResult(null);
                if ((_b = res.data.data.meta) === null || _b === void 0 ? void 0 : _b.insufficient) {
                    Taro.showToast({
                        title: `部分标的K线数据不足，已标注于结果`,
                        icon: 'none',
                        duration: 2500,
                    });
                }
            }
            else {
                setErrorMsg(((_c = res.data) === null || _c === void 0 ? void 0 : _c.message) || ((_d = res.data) === null || _d === void 0 ? void 0 : _d.msg) || '回测失败');
                Taro.showToast({ title: ((_e = res.data) === null || _e === void 0 ? void 0 : _e.message) || ((_f = res.data) === null || _f === void 0 ? void 0 : _f.msg) || '回测失败', icon: 'none' });
            }
        }
        catch (error) {
            console.error('全局组合回测失败:', error);
            const msg = ((_g = error === null || error === void 0 ? void 0 : error.data) === null || _g === void 0 ? void 0 : _g.message) || (error === null || error === void 0 ? void 0 : error.message) || '回测失败';
            setErrorMsg(msg);
            Taro.showToast({ title: msg, icon: 'none', duration: 3000 });
        }
        finally {
            setLoading(false);
        }
    };
    const toggleIndicator = (ind) => {
        if (indicators.includes(ind)) {
            setIndicators(indicators.filter(i => i !== ind));
        }
        else {
            setIndicators([...indicators, ind]);
        }
    };
    return (_jsx(ScrollView, { scrollY: true, className: "h-full bg-slate-900", children: _jsxs(View, { className: "p-4 pb-20", children: [_jsxs(View, { className: "flex gap-2 mb-4", children: [_jsxs(Button, { variant: mode === 'portfolio' ? 'default' : 'outline', className: `flex-1 ${mode === 'portfolio' ? 'bg-blue-500 text-white' : 'border-slate-700 text-slate-400'}`, onClick: () => setMode('portfolio'), children: [_jsx(Globe, { size: 14, className: "mr-1", color: mode === 'portfolio' ? '#ffffff' : '#94a3b8' }), _jsx(Text, { className: "block text-xs", children: "\u5168\u5C40\u7EC4\u5408\u56DE\u6D4B" })] }), _jsx(Button, { variant: mode === 'single' ? 'default' : 'outline', className: `flex-1 ${mode === 'single' ? 'bg-blue-500 text-white' : 'border-slate-700 text-slate-400'}`, onClick: () => setMode('single'), children: _jsx(Text, { className: "block text-xs", children: "\u5355\u6807\u7684\u56DE\u6D4B" }) })] }), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs(CardTitle, { className: "text-slate-100 text-base flex items-center gap-2", children: [_jsx(ChartBar, { size: 18, color: "#3b82f6" }), _jsx(Text, { className: "block", children: mode === 'portfolio' ? '全局组合回测参数' : '回测参数' })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [mode === 'portfolio' && (_jsx(View, { className: "bg-blue-500 bg-opacity-10 border border-blue-500 border-opacity-20 rounded-lg p-3", children: _jsx(Text, { className: "block text-xs text-blue-400", children: "\u5168\u5C40\u7EC4\u5408\u56DE\u6D4B\u5C06\u8986\u76D6\u5173\u6CE8\u5217\u8868\u4E2D\u6240\u6709\u5DF2\u5F00\u542F\u7684\u80A1\u7968\uFF0C\u4F7F\u7528\u771F\u5B9E\u5386\u53F2\u884C\u60C5\uFF08\u65B0\u6D6A\u65E5K\uFF09\uFF0C\u5171\u4EAB\u8D44\u91D1\u6C60\u6A21\u62DF\u4EA4\u6613\u3002" }) })), mode === 'single' && (_jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400 mb-2", children: "\u56DE\u6D4B\u6807\u7684" }), _jsxs(Select, { value: symbol, onValueChange: setSymbol, children: [_jsx(SelectTrigger, { className: "bg-slate-900 border-slate-700", children: _jsx(SelectValue, { placeholder: "\u9009\u62E9\u80A1\u7968" }) }), _jsx(SelectContent, { children: STOCK_LIST.map(stock => (_jsx(SelectItem, { value: stock.symbol, children: _jsxs(Text, { className: "block", children: [stock.name, " (", stock.symbol, ")"] }) }, stock.symbol))) })] })] })), _jsxs(View, { className: "flex gap-3", children: [_jsxs(View, { className: "flex-1", children: [_jsx(Text, { className: "block text-xs text-slate-400 mb-2", children: "\u5F00\u59CB\u65E5\u671F" }), _jsx(Input, { type: "text", value: startDate, onInput: (e) => setStartDate(e.detail.value), placeholder: "YYYY-MM-DD", className: "bg-slate-900 border-slate-700 text-slate-100" })] }), _jsxs(View, { className: "flex-1", children: [_jsx(Text, { className: "block text-xs text-slate-400 mb-2", children: "\u7ED3\u675F\u65E5\u671F" }), _jsx(Input, { type: "text", value: endDate, onInput: (e) => setEndDate(e.detail.value), placeholder: "YYYY-MM-DD", className: "bg-slate-900 border-slate-700 text-slate-100" })] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400 mb-2", children: "\u521D\u59CB\u8D44\u91D1" }), _jsx(Input, { type: "number", value: initialCapital, onInput: (e) => setInitialCapital(e.detail.value), placeholder: "100000", className: "bg-slate-900 border-slate-700 text-slate-100" })] }), mode === 'single' && (_jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400 mb-2", children: "\u6280\u672F\u6307\u6807" }), _jsx(View, { className: "flex flex-wrap gap-2", children: ['MA', 'EMA', 'MACD', 'RSI', 'BOLL', 'KDJ'].map(ind => (_jsx(Badge, { variant: indicators.includes(ind) ? 'default' : 'outline', className: `cursor-pointer ${indicators.includes(ind)
                                                    ? 'bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-30'
                                                    : 'border-slate-600 text-slate-400'}`, onClick: () => toggleIndicator(ind), children: _jsx(Text, { className: "block text-xs", children: ind }) }, ind))) })] })), _jsxs(Button, { className: "w-full bg-blue-500 text-white", onClick: handleBacktest, disabled: loading, children: [_jsx(Play, { size: 16, className: "mr-2", color: "#ffffff" }), _jsx(Text, { className: "block", children: loading ? '回测中...' : (mode === 'portfolio' ? '开始全局回测' : '开始回测') })] })] })] }), errorMsg && (_jsx(Card, { className: "bg-red-500 bg-opacity-10 border-red-500 border-opacity-30 mb-4", children: _jsx(CardContent, { className: "py-3", children: _jsxs(View, { className: "flex items-start gap-2", children: [_jsx(TriangleAlert, { size: 14, color: "#f87171", className: "mt-1 flex-shrink-0" }), _jsxs(View, { className: "flex-1", children: [_jsx(Text, { className: "block text-sm text-red-400 font-medium mb-1", children: "\u56DE\u6D4B\u5931\u8D25" }), _jsx(Text, { className: "block text-xs text-red-300", children: errorMsg }), _jsx(Text, { className: "block text-xs text-red-400 mt-2 opacity-70", children: "\u8BF7\u68C0\u67E5\u80A1\u7968\u4EE3\u7801\u662F\u5426\u6B63\u786E\uFF0C\u6216\u6269\u5927\u56DE\u6D4B\u65F6\u95F4\u8303\u56F4\u3002" })] })] }) }) })), portfolioResult && (_jsxs(_Fragment, { children: [_jsx(Card, { className: `mb-4 ${portfolioResult.meta.dataSource === 'mock'
                                ? 'bg-amber-500 bg-opacity-10 border-amber-500 border-opacity-30'
                                : portfolioResult.meta.dataSource === 'cache'
                                    ? 'bg-blue-500 bg-opacity-10 border-blue-500 border-opacity-30'
                                    : 'bg-emerald-500 bg-opacity-10 border-emerald-500 border-opacity-20'}`, children: _jsx(CardContent, { className: "py-3", children: _jsxs(View, { className: "flex items-center gap-2", children: [portfolioResult.meta.dataSource === 'mock' ? (_jsxs(Badge, { variant: "outline", className: "border-amber-500 border-opacity-40 text-amber-400 bg-amber-500 bg-opacity-10", children: [_jsx(CircleAlert, { size: 11, color: "#fbbf24", className: "mr-1" }), _jsx(Text, { className: "block text-xs", children: "\u6A21\u62DF\u6570\u636E" })] })) : portfolioResult.meta.dataSource === 'cache' ? (_jsxs(Badge, { variant: "outline", className: "border-blue-500 border-opacity-40 text-blue-400 bg-blue-500 bg-opacity-10", children: [_jsx(Database, { size: 11, color: "#60a5fa", className: "mr-1" }), _jsx(Text, { className: "block text-xs", children: "\u672C\u5730\u7F13\u5B58" })] })) : (_jsxs(Badge, { variant: "outline", className: "border-emerald-500 border-opacity-30 text-emerald-400 bg-emerald-500 bg-opacity-10", children: [_jsx(CircleCheck, { size: 11, color: "#34d399", className: "mr-1" }), _jsx(Text, { className: "block text-xs", children: "\u771F\u5B9E\u884C\u60C5" })] })), _jsxs(Text, { className: `block text-xs ${portfolioResult.meta.dataSource === 'mock' ? 'text-amber-400' :
                                                portfolioResult.meta.dataSource === 'cache' ? 'text-blue-400' : 'text-emerald-400'}`, children: [portfolioResult.meta.dataSource === 'tencent' ? '腾讯' :
                                                    portfolioResult.meta.dataSource === 'sina' ? '新浪' :
                                                        portfolioResult.meta.dataSource === 'cache' ? '本地缓存' : '合成数据', " |", ' ', portfolioResult.meta.symbols.length, "\u53EA\u6807\u7684 | ", portfolioResult.metrics.tradingDays, "\u4E2A\u4EA4\u6613\u65E5", portfolioResult.meta.insufficient && ' · 部分数据不足'] })] }) }) }), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs(CardTitle, { className: "text-slate-100 text-base flex items-center gap-2", children: [_jsx(Globe, { size: 16, color: "#3b82f6" }), _jsx(Text, { className: "block", children: "\u7EC4\u5408\u6536\u76CA\u6982\u89C8" })] }) }), _jsx(CardContent, { children: _jsxs(View, { className: "grid grid-cols-2 gap-4", children: [_jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u7EC4\u5408\u6536\u76CA" }), _jsxs(View, { className: "flex items-center gap-1", children: [portfolioResult.metrics.totalReturn > 0 ? (_jsx(TrendingUp, { size: 14, color: "#22c55e" })) : portfolioResult.metrics.totalReturn < 0 ? (_jsx(TrendingDown, { size: 14, color: "#ef4444" })) : null, _jsxs(Text, { className: `block text-lg font-bold ${portfolioResult.metrics.totalReturn > 0 ? 'text-green-500' : portfolioResult.metrics.totalReturn < 0 ? 'text-red-500' : 'text-slate-400'}`, children: [portfolioResult.metrics.totalReturn > 0 ? '+' : '', (portfolioResult.metrics.totalReturn * 100).toFixed(2), "%"] })] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u5E74\u5316\u6536\u76CA" }), _jsxs(Text, { className: `block text-lg font-bold ${portfolioResult.metrics.annualizedReturn > 0 ? 'text-green-500' : 'text-red-500'}`, children: [portfolioResult.metrics.annualizedReturn > 0 ? '+' : '', (portfolioResult.metrics.annualizedReturn * 100).toFixed(2), "%"] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u521D\u59CB\u8D44\u91D1" }), _jsxs(Text, { className: "block text-base font-bold text-slate-100", children: ["\u00A5", portfolioResult.meta.initialCapital.toLocaleString()] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6700\u7EC8\u51C0\u503C" }), _jsxs(Text, { className: `block text-base font-bold ${portfolioResult.meta.finalValue >= portfolioResult.meta.initialCapital ? 'text-green-500' : 'text-red-500'}`, children: ["\u00A5", portfolioResult.meta.finalValue.toLocaleString()] })] })] }) })] }), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs(CardTitle, { className: "text-slate-100 text-base flex items-center gap-2", children: [_jsx(TriangleAlert, { size: 16, color: "#f59e0b" }), _jsx(Text, { className: "block", children: "\u98CE\u9669\u6307\u6807" })] }) }), _jsx(CardContent, { children: _jsxs(View, { className: "grid grid-cols-2 gap-4", children: [_jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6700\u5927\u56DE\u64A4" }), _jsxs(Text, { className: "block text-base font-bold text-red-500", children: ["-", (portfolioResult.metrics.maxDrawdown * 100).toFixed(2), "%"] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u590F\u666E\u6BD4\u7387" }), _jsx(Text, { className: `block text-base font-bold ${portfolioResult.metrics.sharpeRatio > 1 ? 'text-green-500' : portfolioResult.metrics.sharpeRatio > 0 ? 'text-amber-500' : 'text-red-500'}`, children: portfolioResult.metrics.sharpeRatio })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u4EA4\u6613\u5929\u6570" }), _jsx(Text, { className: "block text-base font-bold text-slate-100", children: portfolioResult.metrics.tradingDays })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u56DE\u6D4B\u533A\u95F4" }), _jsxs(Text, { className: "block text-xs font-bold text-slate-300", children: [portfolioResult.meta.dateRange.start, " ~ ", portfolioResult.meta.dateRange.end] })] })] }) })] }), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-2", children: _jsxs(CardTitle, { className: "text-slate-100 text-base flex items-center gap-2", children: [_jsx(ChartBar, { size: 16, color: "#10b981" }), _jsx(Text, { className: "block", children: "\u7EC4\u5408\u51C0\u503C\u66F2\u7EBF" })] }) }), _jsx(CardContent, { className: "pt-0", children: _jsx(LineChart, { data: equityPoints, color: portfolioResult.metrics.totalReturn >= 0 ? '#ef4444' : '#22c55e', fillColors: portfolioResult.metrics.totalReturn >= 0
                                            ? ['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0)']
                                            : ['rgba(34, 197, 94, 0.3)', 'rgba(34, 197, 94, 0)'], height: 180, formatValue: (v) => v.toFixed(3) }) })] }), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-2", children: _jsx(CardTitle, { className: "text-slate-100 text-sm", children: "\u56DE\u64A4\u8D70\u52BF" }) }), _jsx(CardContent, { className: "pt-0", children: _jsx(LineChart, { data: drawdownPoints, color: "#f97316", fillColors: ['rgba(249, 115, 22, 0.2)', 'rgba(249, 115, 22, 0)'], height: 90, showZeroLine: true, formatValue: (v) => `${v.toFixed(1)}%`, emptyText: "\u6682\u65E0\u56DE\u64A4\u6570\u636E" }) })] }), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs(CardTitle, { className: "text-slate-100 text-base flex items-center gap-2", children: [_jsx(Target, { size: 16, color: "#10b981" }), _jsx(Text, { className: "block", children: "\u4EA4\u6613\u7EDF\u8BA1" })] }) }), _jsx(CardContent, { children: _jsxs(View, { className: "grid grid-cols-3 gap-4", children: [_jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u603B\u4EA4\u6613" }), _jsx(Text, { className: "block text-lg font-bold text-slate-100", children: portfolioResult.metrics.tradeCount })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u80DC\u7387" }), _jsxs(Text, { className: `block text-lg font-bold ${portfolioResult.metrics.winRate >= 50 ? 'text-green-500' : 'text-amber-500'}`, children: [(portfolioResult.metrics.winRate * 100).toFixed(1), "%"] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u76C8\u4E8F\u6BD4" }), _jsx(Text, { className: "block text-lg font-bold text-slate-100", children: portfolioResult.metrics.profitFactor })] })] }) })] }), portfolioResult.trades.length > 0 && (_jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-3", children: _jsx(CardTitle, { className: "text-slate-100 text-base", children: "\u4EA4\u6613\u8BB0\u5F55" }) }), _jsxs(CardContent, { children: [portfolioResult.trades.slice(0, 20).map((trade, idx) => (_jsxs(View, { className: "flex items-center justify-between py-2 border-b border-slate-700 last:border-0", children: [_jsxs(View, { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: trade.type === 'BUY' ? 'default' : 'destructive', className: "text-xs", children: _jsx(Text, { className: "block", children: trade.type === 'BUY' ? '买' : '卖' }) }), _jsxs(View, { children: [_jsx(Text, { className: "block text-sm text-slate-100", children: trade.name }), _jsx(Text, { className: "block text-xs text-slate-400", children: trade.date })] })] }), _jsxs(View, { className: "text-right", children: [_jsxs(Text, { className: "block text-sm text-slate-100", children: ["\u00A5", trade.price.toFixed(2)] }), _jsxs(Text, { className: "block text-xs text-slate-400", children: [trade.quantity, "\u80A1"] })] })] }, trade.id || idx))), portfolioResult.trades.length > 20 && (_jsxs(Text, { className: "block text-xs text-slate-500 text-center mt-2", children: ["\u4EC5\u663E\u793A\u524D20\u6761\uFF0C\u5171", portfolioResult.trades.length, "\u6761\u8BB0\u5F55"] }))] })] })), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-3", children: _jsx(CardTitle, { className: "text-slate-100 text-base", children: "\u53C2\u4E0E\u6807\u7684" }) }), _jsx(CardContent, { children: _jsx(View, { className: "flex flex-wrap gap-2", children: portfolioResult.meta.symbols.map(sym => (_jsx(Badge, { variant: "outline", className: "border-slate-600 text-slate-300", children: _jsx(Text, { className: "block text-xs", children: sym }) }, sym))) }) })] })] })), result && (_jsxs(_Fragment, { children: [_jsx(Card, { className: `mb-4 ${((_a = result.meta) === null || _a === void 0 ? void 0 : _a.dataSource) === 'mock'
                                ? 'bg-amber-500 bg-opacity-10 border-amber-500 border-opacity-30'
                                : ((_b = result.meta) === null || _b === void 0 ? void 0 : _b.dataSource) === 'cache'
                                    ? 'bg-blue-500 bg-opacity-10 border-blue-500 border-opacity-30'
                                    : 'bg-emerald-500 bg-opacity-10 border-emerald-500 border-opacity-20'}`, children: _jsx(CardContent, { className: "py-3", children: _jsxs(View, { className: "flex items-center gap-2", children: [((_c = result.meta) === null || _c === void 0 ? void 0 : _c.dataSource) === 'mock' ? (_jsxs(Badge, { variant: "outline", className: "border-amber-500 border-opacity-40 text-amber-400 bg-amber-500 bg-opacity-10", children: [_jsx(CircleAlert, { size: 11, color: "#fbbf24", className: "mr-1" }), _jsx(Text, { className: "block text-xs", children: "\u6A21\u62DF\u6570\u636E" })] })) : ((_d = result.meta) === null || _d === void 0 ? void 0 : _d.dataSource) === 'cache' ? (_jsxs(Badge, { variant: "outline", className: "border-blue-500 border-opacity-40 text-blue-400 bg-blue-500 bg-opacity-10", children: [_jsx(Database, { size: 11, color: "#60a5fa", className: "mr-1" }), _jsx(Text, { className: "block text-xs", children: "\u672C\u5730\u7F13\u5B58" })] })) : (_jsxs(Badge, { variant: "outline", className: "border-emerald-500 border-opacity-30 text-emerald-400 bg-emerald-500 bg-opacity-10", children: [_jsx(CircleCheck, { size: 11, color: "#34d399", className: "mr-1" }), _jsx(Text, { className: "block text-xs", children: "\u771F\u5B9E\u884C\u60C5" })] })), _jsxs(Text, { className: `block text-xs ${((_e = result.meta) === null || _e === void 0 ? void 0 : _e.dataSource) === 'mock' ? 'text-amber-400' :
                                                ((_f = result.meta) === null || _f === void 0 ? void 0 : _f.dataSource) === 'cache' ? 'text-blue-400' : 'text-emerald-400'}`, children: [((_g = result.meta) === null || _g === void 0 ? void 0 : _g.dataSource) === 'tencent' ? '腾讯' :
                                                    ((_h = result.meta) === null || _h === void 0 ? void 0 : _h.dataSource) === 'sina' ? '新浪' :
                                                        ((_j = result.meta) === null || _j === void 0 ? void 0 : _j.dataSource) === 'cache' ? '本地缓存' :
                                                            ((_k = result.meta) === null || _k === void 0 ? void 0 : _k.dataSource) === 'mock' ? '合成数据' : '数据源', " |", ' ', result.symbol, " ", result.startDate, "~", result.endDate, " |", ' ', result.tradingDays, "\u4E2A\u4EA4\u6613\u65E5", ((_l = result.meta) === null || _l === void 0 ? void 0 : _l.insufficient) && ' · 数据不足'] })] }) }) }), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-3", children: _jsx(CardTitle, { className: "text-slate-100 text-base", children: "\u6536\u76CA\u6982\u89C8" }) }), _jsx(CardContent, { children: _jsxs(View, { className: "grid grid-cols-2 gap-4", children: [_jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u7B56\u7565\u6536\u76CA" }), _jsxs(View, { className: "flex items-center gap-1", children: [result.totalReturn > 0 ? (_jsx(TrendingUp, { size: 14, color: "#22c55e" })) : result.totalReturn < 0 ? (_jsx(TrendingDown, { size: 14, color: "#ef4444" })) : null, _jsxs(Text, { className: `block text-lg font-bold ${result.totalReturn > 0 ? 'text-green-500' : result.totalReturn < 0 ? 'text-red-500' : 'text-slate-400'}`, children: [result.totalReturn > 0 ? '+' : '', result.totalReturn, "%"] })] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u57FA\u51C6\u6536\u76CA" }), _jsxs(View, { className: "flex items-center gap-1", children: [result.benchmarkReturn > 0 ? (_jsx(TrendingUp, { size: 14, color: "#3b82f6" })) : (_jsx(TrendingDown, { size: 14, color: "#ef4444" })), _jsxs(Text, { className: `block text-lg font-bold ${result.benchmarkReturn > 0 ? 'text-blue-400' : 'text-red-500'}`, children: [result.benchmarkReturn > 0 ? '+' : '', result.benchmarkReturn, "%"] })] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6700\u7EC8\u8D44\u91D1" }), _jsxs(Text, { className: "block text-base font-bold text-slate-100", children: ["\u00A5", result.finalCapital.toLocaleString()] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u5E74\u5316\u6536\u76CA" }), _jsxs(Text, { className: `block text-base font-bold ${result.annualizedReturn > 0 ? 'text-green-500' : 'text-red-500'}`, children: [result.annualizedReturn > 0 ? '+' : '', result.annualizedReturn, "%"] })] })] }) })] }), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs(CardTitle, { className: "text-slate-100 text-base flex items-center gap-2", children: [_jsx(TriangleAlert, { size: 16, color: "#f59e0b" }), _jsx(Text, { className: "block", children: "\u98CE\u9669\u6307\u6807" })] }) }), _jsx(CardContent, { children: _jsxs(View, { className: "grid grid-cols-2 gap-4", children: [_jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6700\u5927\u56DE\u64A4" }), _jsxs(Text, { className: "block text-base font-bold text-red-500", children: ["-", result.maxDrawdown, "%"] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6CE2\u52A8\u7387" }), _jsxs(Text, { className: "block text-base font-bold text-slate-100", children: [result.volatility, "%"] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u590F\u666E\u6BD4\u7387" }), _jsx(Text, { className: `block text-base font-bold ${result.sharpeRatio > 1 ? 'text-green-500' : result.sharpeRatio > 0 ? 'text-amber-500' : 'text-red-500'}`, children: result.sharpeRatio })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u7D22\u63D0\u8BFA\u6BD4\u7387" }), _jsx(Text, { className: "block text-base font-bold text-slate-100", children: result.sortinoRatio })] })] }) })] }), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-2", children: _jsxs(CardTitle, { className: "text-slate-100 text-base flex items-center gap-2", children: [_jsx(ChartBar, { size: 16, color: "#10b981" }), _jsx(Text, { className: "block", children: "\u6536\u76CA\u66F2\u7EBF" })] }) }), _jsxs(CardContent, { className: "pt-0", children: [_jsx(LineChart, { data: equityPoints, color: result.totalReturn >= 0 ? '#ef4444' : '#22c55e', fillColors: result.totalReturn >= 0
                                                ? ['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0)']
                                                : ['rgba(34, 197, 94, 0.3)', 'rgba(34, 197, 94, 0)'], height: 180, formatValue: (v) => v.toFixed(3) }), _jsxs(View, { className: "flex gap-4 mt-2 justify-center", children: [_jsxs(View, { className: "flex items-center gap-1", children: [_jsx(View, { className: "w-2 h-2 rounded-full bg-red-500" }), _jsx(Text, { className: "block text-xs text-slate-400", children: "\u25B2 \u4E70\u5165" })] }), _jsxs(View, { className: "flex items-center gap-1", children: [_jsx(View, { className: "w-2 h-2 rounded-full bg-green-500" }), _jsx(Text, { className: "block text-xs text-slate-400", children: "\u25BC \u5356\u51FA" })] })] })] })] }), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-2", children: _jsx(CardTitle, { className: "text-slate-100 text-sm", children: "\u56DE\u64A4\u8D70\u52BF" }) }), _jsx(CardContent, { className: "pt-0", children: _jsx(LineChart, { data: drawdownPoints, color: "#f97316", fillColors: ['rgba(249, 115, 22, 0.2)', 'rgba(249, 115, 22, 0)'], height: 90, showZeroLine: true, formatValue: (v) => `${v.toFixed(1)}%`, emptyText: "\u6682\u65E0\u56DE\u64A4\u6570\u636E" }) })] }), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs(CardTitle, { className: "text-slate-100 text-base flex items-center gap-2", children: [_jsx(Target, { size: 16, color: "#10b981" }), _jsx(Text, { className: "block", children: "\u4EA4\u6613\u7EDF\u8BA1" })] }) }), _jsx(CardContent, { children: _jsxs(View, { className: "grid grid-cols-3 gap-4", children: [_jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u603B\u4EA4\u6613" }), _jsx(Text, { className: "block text-lg font-bold text-slate-100", children: result.totalTrades })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u80DC\u7387" }), _jsxs(Text, { className: `block text-lg font-bold ${result.winRate >= 50 ? 'text-green-500' : 'text-amber-500'}`, children: [result.winRate, "%"] })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u76C8\u4E8F\u6BD4" }), _jsx(Text, { className: "block text-lg font-bold text-slate-100", children: result.profitFactor })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u76C8\u5229\u6B21\u6570" }), _jsx(Text, { className: "block text-base font-bold text-green-500", children: result.winTrades })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u4E8F\u635F\u6B21\u6570" }), _jsx(Text, { className: "block text-base font-bold text-red-500", children: result.loseTrades })] }), _jsxs(View, { children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u4EA4\u6613\u5929\u6570" }), _jsx(Text, { className: "block text-base font-bold text-slate-100", children: result.tradingDays })] })] }) })] }), result.trades.length > 0 && (_jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-3", children: _jsx(CardTitle, { className: "text-slate-100 text-base", children: "\u4EA4\u6613\u8BB0\u5F55" }) }), _jsx(CardContent, { children: _jsx(ScrollView, { scrollY: true, className: "max-h-60", children: result.trades.map((trade, idx) => (_jsxs(View, { children: [_jsxs(View, { className: "flex items-center justify-between py-2", children: [_jsxs(View, { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: trade.type === 'BUY' ? 'default' : 'destructive', className: trade.type === 'BUY' ? 'bg-green-500 bg-opacity-20 text-green-400' : 'bg-red-500 bg-opacity-20 text-red-400', children: _jsx(Text, { className: "block text-xs", children: trade.type === 'BUY' ? '买入' : '卖出' }) }), _jsx(Text, { className: "block text-sm text-slate-300", children: trade.date })] }), _jsxs(View, { className: "text-right", children: [_jsxs(Text, { className: "block text-sm text-slate-100", children: ["\u00A5", trade.price, " x ", trade.quantity] }), _jsx(Text, { className: "block text-xs text-slate-400", children: trade.reason })] })] }), idx < result.trades.length - 1 && _jsx(Separator, { className: "bg-slate-700" })] }, idx))) }) })] })), _jsxs(Card, { className: "bg-slate-800 border-slate-700 mb-4", children: [_jsx(CardHeader, { className: "pb-3", children: _jsx(CardTitle, { className: "text-slate-100 text-base", children: "\u6536\u76CA\u66F2\u7EBF" }) }), _jsxs(CardContent, { children: [_jsx(View, { className: "h-40 flex items-end justify-between gap-1", children: result.equityCurve
                                                .filter((_, i) => i % Math.ceil(result.equityCurve.length / 30) === 0)
                                                .map((point, idx, arr) => {
                                                const min = Math.min(...arr.map(p => p.value));
                                                const max = Math.max(...arr.map(p => p.value));
                                                const range = max - min || 1;
                                                const height = ((point.value - min) / range) * 100;
                                                return (_jsx(View, { className: "flex-1 bg-emerald-500 bg-opacity-60 rounded-t", style: { height: `${Math.max(height, 5)}%` } }, idx));
                                            }) }), _jsxs(View, { className: "flex justify-between mt-2", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: result.startDate }), _jsx(Text, { className: "block text-xs text-slate-400", children: result.endDate })] })] })] })] }))] }) }));
}
//# sourceMappingURL=index.js.map