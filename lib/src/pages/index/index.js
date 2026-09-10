import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useEffect, useRef, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, Activity, Shield, ArrowUpRight, ArrowDownRight, Zap, Bell, Rocket, Eye, RefreshCw, CircleCheck, CircleAlert, } from 'lucide-react-taro';
const POLL_INTERVAL = 6000;
const IndexPage = () => {
    var _a, _b, _c, _d, _e, _f;
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(null);
    const [watchlist, setWatchlist] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [lastTickAt, setLastTickAt] = useState(0);
    const [quoteSourceOk, setQuoteSourceOk] = useState(null);
    const timerRef = useRef(null);
    const formatMoney = (val) => {
        if (Math.abs(val) >= 10000)
            return `${(val / 10000).toFixed(2)}万`;
        return val.toFixed(2);
    };
    const fmtPct = (val) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
    const fmtPnl = (val) => `${val >= 0 ? '+' : ''}${formatMoney(val)}`;
    const [showTour, setShowTour] = useState(false);
    const [tourStep, setTourStep] = useState(0);
    // 首次配置完成后展示功能 Tour
    useEffect(() => {
        if ((status === null || status === void 0 ? void 0 : status.configured) && !loading) {
            const hasSeen = Taro.getStorageSync('tour_seen_v2');
            if (!hasSeen) {
                setShowTour(true);
            }
        }
    }, [status === null || status === void 0 ? void 0 : status.configured, loading]);
    const closeTour = () => {
        setShowTour(false);
        Taro.setStorageSync('tour_seen_v2', '1');
    };
    /** 拉取关注列表启用标的的真实行情，驱动后端实时重估+信号引擎 */
    const tickOnce = useCallback(async () => {
        var _a, _b, _c, _d, _e;
        try {
            setRefreshing(true);
            const wlRes = await Network.request({ url: '/api/stock/watchlist' });
            const wl = Array.isArray((_a = wlRes.data) === null || _a === void 0 ? void 0 : _a.data) ? wlRes.data.data : [];
            setWatchlist(wl);
            const statusRes = await Network.request({ url: '/api/beta/status' });
            const st = (_b = statusRes.data) === null || _b === void 0 ? void 0 : _b.data;
            setStatus(st);
            if (!(st === null || st === void 0 ? void 0 : st.configured)) {
                setLoading(false);
                return;
            }
            // 启用标的 → 拉真实行情 → 后端重估 + 信号检测
            const enabled = wl.filter((w) => w.enabled);
            if (enabled.length > 0) {
                const marketRes = await Network.request({ url: '/api/market/list' });
                const allQuotes = Array.isArray((_c = marketRes.data) === null || _c === void 0 ? void 0 : _c.data)
                    ? marketRes.data.data
                    : [];
                const enabledSet = new Set(enabled.map((w) => w.symbol));
                const quotes = allQuotes.filter((q) => enabledSet.has(q.symbol));
                const marketData = quotes.map((q) => {
                    var _a;
                    return ({
                        symbol: q.symbol,
                        price: q.price,
                        changePercent: (_a = q.changePercent) !== null && _a !== void 0 ? _a : 0,
                    });
                });
                if (marketData.length > 0) {
                    const tickRes = await Network.request({
                        url: '/api/beta/tick',
                        method: 'POST',
                        data: { marketData },
                    });
                    console.log('beta tick:', tickRes.data);
                }
            }
            // tick 后再拉最新账户收益
            const statusRes2 = await Network.request({ url: '/api/beta/status' });
            setStatus((_d = statusRes2.data) === null || _d === void 0 ? void 0 : _d.data);
            const notifyRes = await Network.request({ url: '/api/notifications?limit=5' });
            const notes = (_e = notifyRes.data) === null || _e === void 0 ? void 0 : _e.data;
            setNotifications(Array.isArray(notes) ? notes : Array.isArray(notes === null || notes === void 0 ? void 0 : notes.items) ? notes.items : []);
            setLastTickAt(Date.now());
        }
        catch (e) {
            console.error('tickOnce error:', e);
        }
        finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        tickOnce();
        timerRef.current = setInterval(tickOnce, POLL_INTERVAL);
        return () => {
            if (timerRef.current)
                clearInterval(timerRef.current);
        };
    }, [tickOnce]);
    // 一次性探测实时行情数据源（用于头部徽标）
    useEffect(() => {
        Network.request({ url: '/api/data-sources' })
            .then((res) => {
            var _a, _b;
            const sources = (_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.data;
            if (sources && Array.isArray(sources)) {
                const quote = sources.find((s) => s.key === 'quote');
                setQuoteSourceOk(quote ? quote.status === 'ok' : null);
            }
        })
            .catch(() => setQuoteSourceOk(null));
    }, []);
    const account = (status === null || status === void 0 ? void 0 : status.configured) && status
        ? {
            cash: (_a = status.cash) !== null && _a !== void 0 ? _a : 0,
            totalValue: (_b = status.totalValue) !== null && _b !== void 0 ? _b : 0,
            totalPnl: (_c = status.totalPnl) !== null && _c !== void 0 ? _c : 0,
            totalPnlRate: (_d = status.totalPnlRate) !== null && _d !== void 0 ? _d : 0,
            isRunning: !!status.isRunning,
            positions: (_e = status.positions) !== null && _e !== void 0 ? _e : [],
        }
        : null;
    const fmtTime = (ts) => {
        if (!ts)
            return '';
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    // ============ 未配置：内测引导 ============
    if (!loading && status && !status.configured) {
        return (_jsx(ScrollView, { scrollY: true, className: "h-full bg-slate-900 smooth-scroll hide-scrollbar tabbar-page", children: _jsxs(View, { className: "px-4 pb-8 pt-16 flex flex-col gap-6 items-center", children: [_jsx(View, { className: "flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500 bg-opacity-10", children: _jsx(Rocket, { size: 40, color: "#10b981" }) }), _jsxs(View, { className: "flex flex-col gap-2 items-center", children: [_jsx(Text, { className: "block text-xl font-bold text-slate-100", children: "\u5F00\u59CB\u5185\u6D4B\u6295\u8D44\u4F53\u9A8C" }), _jsx(Text, { className: "block text-sm text-slate-500 text-center", children: '三步从零开始：设定投入金额、关注股票、配置策略\nAI Agent 自动监听实时行情并模拟交易' })] }), _jsx(Button, { className: "bg-emerald-500 text-slate-900 rounded-xl px-8", onClick: () => Taro.navigateTo({ url: '/pages/onboarding/index' }), children: _jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Zap, { size: 16, color: "#0f172a" }), _jsx(Text, { className: "block text-base font-semibold", children: "\u7ACB\u5373\u5F00\u59CB" })] }) })] }) }));
    }
    const pnlColor = (val) => (val >= 0 ? 'text-red-500' : 'text-green-500');
    return (_jsx(ScrollView, { scrollY: true, className: "h-full bg-slate-900 smooth-scroll hide-scrollbar tabbar-page", children: _jsxs(View, { className: "px-4 pb-8 pt-4 flex flex-col gap-4", children: [_jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-lg font-bold text-slate-100", children: "\u5B9E\u65F6\u770B\u76D8" }), _jsx(Text, { className: "block text-xs text-slate-500", children: (account === null || account === void 0 ? void 0 : account.isRunning) ? `模拟投资运行中 · ${watchlist.filter((w) => w.enabled).length} 只启用` : '已停止' })] }), _jsxs(View, { className: "flex flex-row items-center gap-2", children: [refreshing && _jsx(RefreshCw, { size: 12, color: "#10b981" }), _jsx(Text, { className: "block text-xs text-slate-500", children: lastTickAt ? `更新 ${fmtTime(lastTickAt)}` : '连接中...' })] })] }), _jsxs(View, { className: "flex flex-row items-center justify-center gap-2 mb-3 flex-wrap", children: [_jsxs(View, { className: "flex flex-row items-center gap-2 px-3 py-1 rounded-full bg-amber-500 bg-opacity-10 border border-amber-500 border-opacity-30", children: [_jsx(Shield, { size: 12, color: "#fbbf24" }), _jsx(Text, { className: "block text-xs font-medium text-amber-400", children: "\u6A21\u62DF\u4EA4\u6613\u4E2D \u00B7 \u4E0D\u6D89\u53CA\u771F\u5B9E\u8D44\u91D1" })] }), quoteSourceOk !== null && (_jsxs(View, { className: `flex flex-row items-center gap-1 px-2 py-1 rounded-full border ${quoteSourceOk
                                ? 'bg-emerald-500 bg-opacity-10 border-emerald-500 border-opacity-30'
                                : 'bg-red-500 bg-opacity-10 border-red-500 border-opacity-30'}`, children: [quoteSourceOk ? (_jsx(CircleCheck, { size: 10, color: "#34d399" })) : (_jsx(CircleAlert, { size: 10, color: "#f87171" })), _jsx(Text, { className: `block text-xs ${quoteSourceOk ? 'text-emerald-400' : 'text-red-400'}`, children: quoteSourceOk ? '行情实时' : '行情降级' })] }))] }), _jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsx(CardContent, { className: "p-5", children: _jsxs(View, { className: "flex flex-col gap-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Wallet, { size: 16, color: "#94a3b8" }), _jsx(Text, { className: "block text-xs text-slate-400", children: "\u6A21\u62DF\u8D26\u6237\u603B\u8D44\u4EA7" })] }), loading || !account ? (_jsx(Skeleton, { className: "h-9 w-40 bg-slate-700" })) : (_jsx(Text, { className: "block text-3xl font-bold text-slate-100 tabular-nums", children: formatMoney(account.totalValue) })), _jsxs(View, { className: "flex flex-row gap-4 mt-1", children: [_jsxs(View, { className: "flex flex-1 flex-row items-center justify-between bg-slate-900 rounded-lg p-3", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u603B\u6536\u76CA" }), _jsx(Text, { className: `block text-sm font-semibold tabular-nums ${account ? pnlColor(account.totalPnl) : 'text-slate-400'}`, children: account ? `${fmtPnl(account.totalPnl)} (${fmtPct(account.totalPnlRate)})` : '--' })] }), account && account.totalPnl >= 0 ? (_jsx(ArrowUpRight, { size: 16, color: "#ef4444" })) : (_jsx(ArrowDownRight, { size: 16, color: "#22c55e" }))] }), _jsxs(View, { className: "flex flex-1 flex-row items-center justify-between bg-slate-900 rounded-lg p-3", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u53EF\u7528\u73B0\u91D1" }), _jsx(Text, { className: "block text-sm font-semibold tabular-nums text-slate-100", children: account ? formatMoney(account.cash) : '--' })] }), _jsx(Activity, { size: 16, color: "#3b82f6" })] })] })] }) }) }), _jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsx(CardContent, { className: "p-4", children: _jsxs(View, { className: "flex flex-col gap-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Eye, { size: 14, color: "#10b981" }), _jsx(Text, { className: "block text-sm font-semibold text-slate-100", children: "\u6301\u4ED3\u660E\u7EC6" })] }), !account || account.positions.length === 0 ? (_jsx(View, { className: "bg-slate-900 rounded-lg p-4", children: _jsx(Text, { className: "block text-xs text-slate-500 text-center", children: "\u6682\u65E0\u6301\u4ED3 \u00B7 \u4FE1\u53F7\u89E6\u53D1\u540E\u5C06\u81EA\u52A8\u6A21\u62DF\u4E70\u5165" }) })) : (_jsx(View, { className: "flex flex-col gap-2", children: account.positions.map((p) => {
                                        var _a, _b, _c, _d, _e, _f;
                                        return (_jsxs(View, { className: "flex flex-row items-center justify-between bg-slate-900 rounded-lg px-3 py-2", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-sm text-slate-100", children: p.name || p.symbol }), _jsx(Text, { className: "block text-xs text-slate-500", children: p.symbol })] }), _jsxs(Text, { className: "block text-xs text-slate-500", children: [p.quantity, "\u80A1 \u00B7 \u6210\u672C ", (_c = (_b = (_a = p.avgCost) === null || _a === void 0 ? void 0 : _a.toFixed) === null || _b === void 0 ? void 0 : _b.call(_a, 2)) !== null && _c !== void 0 ? _c : p.avgCost, " \u00B7 \u5E02\u503C ", formatMoney(p.marketValue)] })] }), _jsxs(View, { className: "flex flex-col gap-1 items-end", children: [_jsx(Text, { className: "block text-sm font-semibold tabular-nums text-slate-100", children: (_f = (_e = (_d = p.currentPrice) === null || _d === void 0 ? void 0 : _d.toFixed) === null || _e === void 0 ? void 0 : _e.call(_d, 2)) !== null && _f !== void 0 ? _f : p.currentPrice }), _jsxs(Text, { className: `block text-xs tabular-nums ${pnlColor(p.pnl)}`, children: [fmtPnl(p.pnl), " (", fmtPct(p.pnlRate), ")"] })] })] }, p.symbol));
                                    }) }))] }) }) }), showTour && (status === null || status === void 0 ? void 0 : status.configured) && (_jsxs(View, { className: "fixed inset-0 z-50 pointer-events-none", children: [_jsx(View, { className: "absolute inset-0 bg-black bg-opacity-70" }), _jsx(View, { className: "absolute top-24 left-4 right-4 pointer-events-auto", children: _jsx(Card, { className: "bg-slate-800 border-emerald-500 border-opacity-60 shadow-xl", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center gap-2 mb-2", children: [_jsxs(Badge, { className: "bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-40", children: ["\u7B2C ", tourStep + 1, " \u6B65 / \u5171 3 \u6B65"] }), _jsx(Text, { className: "block text-xs text-slate-400 ml-auto", onClick: closeTour, children: "\u8DF3\u8FC7" })] }), tourStep === 0 && (_jsxs(_Fragment, { children: [_jsx(Text, { className: "block text-base font-bold text-emerald-400 mb-1", children: "\u5B9E\u65F6\u8D44\u4EA7\u603B\u89C8" }), _jsx(Text, { className: "block text-sm text-slate-300 leading-relaxed", children: "\u9876\u90E8\u5361\u7247\u5C55\u793A\u603B\u8D44\u4EA7\u3001\u4ECA\u65E5\u76C8\u4E8F\u548C\u6536\u76CA\u7387\uFF0C\u6BCF 6 \u79D2\u81EA\u52A8\u5237\u65B0\u3002" })] })), tourStep === 1 && (_jsxs(_Fragment, { children: [_jsx(Text, { className: "block text-base font-bold text-emerald-400 mb-1", children: "\u6301\u4ED3\u660E\u7EC6" }), _jsx(Text, { className: "block text-sm text-slate-300 leading-relaxed", children: "\u70B9\u8FDB\u5355\u53EA\u80A1\u7968\u67E5\u770B\u6210\u672C\u3001\u6D6E\u76C8\u6D6E\u4E8F\uFF0C\u652F\u6301\u624B\u52A8\u52A0\u4ED3\u3001\u51CF\u4ED3\u3001\u6E05\u4ED3\u3002" })] })), tourStep === 2 && (_jsxs(_Fragment, { children: [_jsx(Text, { className: "block text-base font-bold text-emerald-400 mb-1", children: "\u5E95\u90E8\u56DB\u5927\u6A21\u5757" }), _jsx(Text, { className: "block text-sm text-slate-300 leading-relaxed", children: "\u9996\u9875\u770B\u76D8\u3001\u884C\u60C5\u9009\u80A1\u3001\u7B56\u7565\u914D\u7F6E\u3001\u6211\u7684\u8BBE\u7F6E\uFF0C\u6309\u9700\u5207\u6362\u3002" })] })), _jsxs(View, { className: "flex flex-row gap-2 mt-4", children: [tourStep > 0 && (_jsx(Button, { className: "flex-1 h-8 bg-slate-700 text-slate-200", variant: "secondary", onClick: () => setTourStep(tourStep - 1), children: _jsx(Text, { className: "text-sm", children: "\u4E0A\u4E00\u6B65" }) })), _jsx(Button, { className: "flex-1 h-8 bg-emerald-500 text-white", onClick: () => {
                                                        if (tourStep < 2) {
                                                            setTourStep(tourStep + 1);
                                                        }
                                                        else {
                                                            closeTour();
                                                        }
                                                    }, children: _jsx(Text, { className: "text-sm font-medium", children: tourStep < 2 ? '下一步' : '开始体验' }) })] })] }) }) })] })), _jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsx(CardContent, { className: "p-4", children: _jsxs(View, { className: "flex flex-col gap-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Bell, { size: 14, color: "#facc15" }), _jsx(Text, { className: "block text-sm font-semibold text-slate-100", children: "Agent \u4FE1\u53F7\u901A\u77E5" }), ((_f = status === null || status === void 0 ? void 0 : status.config) === null || _f === void 0 ? void 0 : _f.autoTrade) && (_jsx(Badge, { className: "bg-emerald-500 bg-opacity-20 text-emerald-400", children: _jsx(Text, { className: "block text-[10px]", children: "\u81EA\u52A8\u4EA4\u6613\u5F00\u542F" }) }))] }), notifications.length === 0 ? (_jsx(View, { className: "bg-slate-900 rounded-lg p-4", children: _jsx(Text, { className: "block text-xs text-slate-500 text-center", children: "\u6682\u65E0\u4FE1\u53F7 \u00B7 \u76D1\u542C\u5F15\u64CE\u8FD0\u884C\u4E2D\uFF0C\u89E6\u53D1\u540E\u5C06\u5B9E\u65F6\u63A8\u9001" }) })) : (_jsx(View, { className: "flex flex-col gap-2", children: notifications.map((n) => (_jsxs(View, { className: "flex flex-row items-start justify-between bg-slate-900 rounded-lg px-3 py-2 gap-2", children: [_jsxs(View, { className: "flex flex-col gap-1 flex-1", children: [_jsx(Text, { className: "block text-xs font-medium text-slate-100", children: n.title }), n.content && _jsx(Text, { className: "block text-xs text-slate-500", children: n.content })] }), n.createdAt && _jsx(Text, { className: "block text-[10px] text-slate-600", children: fmtTime(n.createdAt) })] }, n.id))) }))] }) }) }), _jsxs(View, { className: "flex flex-row gap-2", children: [_jsx(Button, { variant: "outline", className: "flex-1 bg-slate-800 border-slate-600 text-slate-300 rounded-xl", onClick: () => Taro.navigateTo({ url: '/pages/backtest/index' }), children: _jsx(Text, { className: "block text-xs", children: "\u533A\u95F4\u56DE\u6D4B" }) }), _jsx(Button, { variant: "outline", className: "flex-1 bg-slate-800 border-slate-600 text-slate-300 rounded-xl", onClick: () => Taro.navigateTo({ url: '/pages/paper-trading/index' }), children: _jsx(Text, { className: "block text-xs", children: "\u4EA4\u6613\u660E\u7EC6" }) }), _jsx(Button, { variant: "outline", className: "flex-1 bg-slate-800 border-slate-600 text-slate-300 rounded-xl", onClick: () => Taro.navigateTo({ url: '/pages/onboarding/index' }), children: _jsx(Text, { className: "block text-xs", children: "\u91CD\u65B0\u914D\u7F6E" }) })] })] }) }));
};
export default IndexPage;
//# sourceMappingURL=index.js.map