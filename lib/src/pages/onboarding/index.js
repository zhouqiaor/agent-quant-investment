import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Wallet, Search, Plus, Trash2, Eye, Brain, Zap, ArrowRight, CircleCheck, TrendingUp, } from 'lucide-react-taro';
const QUICK_AMOUNTS = [50000, 100000, 300000, 500000];
const OnboardingPage = () => {
    const [step, setStep] = useState(1);
    const [capital, setCapital] = useState('100000');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [strategies, setStrategies] = useState([]);
    const [selectedStrategyId, setSelectedStrategyId] = useState('');
    const [autoTrade, setAutoTrade] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    useEffect(() => {
        loadWatchlist();
        loadStrategies();
    }, []);
    const loadWatchlist = async () => {
        var _a;
        try {
            const res = await Network.request({ url: '/api/stock/watchlist' });
            const list = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            if (Array.isArray(list))
                setWatchlist(list);
        }
        catch (e) {
            console.error('loadWatchlist error:', e);
        }
    };
    const loadStrategies = async () => {
        var _a, _b;
        try {
            const [builtinRes, customRes] = await Promise.all([
                Network.request({ url: '/api/strategies' }),
                Network.request({ url: '/api/strategies/custom' }),
            ]);
            const builtin = ((_a = builtinRes.data) === null || _a === void 0 ? void 0 : _a.data) || [];
            const custom = ((_b = customRes.data) === null || _b === void 0 ? void 0 : _b.data) || [];
            const all = [...builtin, ...custom];
            setStrategies(all);
            if (all.length > 0)
                setSelectedStrategyId(all[0].id);
        }
        catch (e) {
            console.error('loadStrategies error:', e);
        }
    };
    const searchStocks = async (q) => {
        var _a;
        if (!q.trim()) {
            setResults([]);
            return;
        }
        try {
            const res = await Network.request({ url: `/api/stock/search?q=${encodeURIComponent(q.trim())}` });
            const data = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            setResults(Array.isArray(data) ? data.slice(0, 6) : []);
        }
        catch (e) {
            console.error('searchStocks error:', e);
        }
    };
    const addWatch = async (symbol, name) => {
        var _a;
        try {
            await Network.request({
                url: '/api/stock/watchlist',
                method: 'POST',
                data: { symbol, name },
            });
            Taro.showToast({ title: '已添加关注', icon: 'none' });
            setQuery('');
            setResults([]);
            loadWatchlist();
        }
        catch (e) {
            const msg = ((_a = e === null || e === void 0 ? void 0 : e.data) === null || _a === void 0 ? void 0 : _a.msg) || (e === null || e === void 0 ? void 0 : e.message) || '添加失败';
            Taro.showToast({ title: msg, icon: 'none' });
        }
    };
    const addCustomStock = async (symbol) => {
        var _a;
        try {
            await Network.request({
                url: '/api/stock/custom',
                method: 'POST',
                data: { symbol },
            });
            await addWatch(symbol);
        }
        catch (e) {
            const msg = ((_a = e === null || e === void 0 ? void 0 : e.data) === null || _a === void 0 ? void 0 : _a.msg) || (e === null || e === void 0 ? void 0 : e.message) || '添加失败';
            Taro.showToast({ title: msg, icon: 'none' });
        }
    };
    const toggleWatch = async (symbol, enabled) => {
        try {
            await Network.request({
                url: '/api/stock/watchlist/toggle',
                method: 'PUT',
                data: { symbol, enabled },
            });
            loadWatchlist();
        }
        catch (e) {
            console.error('toggleWatch error:', e);
        }
    };
    const removeWatch = async (symbol) => {
        try {
            await Network.request({ url: `/api/stock/watchlist/${symbol}`, method: 'DELETE' });
            loadWatchlist();
        }
        catch (e) {
            console.error('removeWatch error:', e);
        }
    };
    const finishSetup = async () => {
        var _a, _b;
        const amount = Number(capital);
        if (!Number.isFinite(amount) || amount <= 0) {
            Taro.showToast({ title: '请输入有效的投入金额', icon: 'none' });
            return;
        }
        const enabledSymbols = watchlist.filter((w) => w.enabled).map((w) => w.symbol);
        if (enabledSymbols.length === 0) {
            Taro.showToast({ title: '请至少开启一只股票的投资', icon: 'none' });
            return;
        }
        try {
            setSubmitting(true);
            await Network.request({
                url: '/api/beta/start',
                method: 'POST',
                data: {
                    initialCapital: amount,
                    watchSymbols: enabledSymbols,
                    strategyId: selectedStrategyId || null,
                    autoTrade,
                },
            });
            // 启动策略监控引擎（信号来源）
            if (selectedStrategyId) {
                try {
                    await Network.request({ url: `/api/strategies/${selectedStrategyId}/start`, method: 'POST' });
                }
                catch (e) {
                    console.error('start strategy monitor error:', e);
                }
            }
            Taro.showToast({ title: '内测投资已开启', icon: 'success' });
            setTimeout(() => {
                Taro.switchTab({ url: '/pages/index/index' });
            }, 800);
        }
        catch (e) {
            const msg = ((_a = e === null || e === void 0 ? void 0 : e.data) === null || _a === void 0 ? void 0 : _a.message) || ((_b = e === null || e === void 0 ? void 0 : e.data) === null || _b === void 0 ? void 0 : _b.msg) || (e === null || e === void 0 ? void 0 : e.message) || '开启失败';
            Taro.showToast({ title: msg, icon: 'none' });
        }
        finally {
            setSubmitting(false);
        }
    };
    const formatMoney = (val) => {
        if (val >= 10000)
            return `${(val / 10000).toFixed(1)}万`;
        return String(val);
    };
    return (_jsx(ScrollView, { scrollY: true, className: "h-full bg-slate-900 smooth-scroll hide-scrollbar", children: _jsxs(View, { className: "px-4 pb-10 pt-5 flex flex-col gap-4", children: [_jsxs(View, { className: "flex flex-col gap-2", children: [_jsx(Text, { className: "block text-xl font-bold text-slate-100", children: "\u5F00\u542F\u5185\u6D4B\u6295\u8D44\u4F53\u9A8C" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u4E09\u6B65\u4ECE\u96F6\u5F00\u59CB\uFF1A\u6295\u5165\u91D1\u989D \u2192 \u5173\u6CE8\u80A1\u7968 \u2192 \u914D\u7F6E\u7B56\u7565" }), _jsx(View, { className: "flex flex-row items-center gap-2 mt-2", children: [1, 2, 3].map((s) => (_jsx(View, { className: `h-1 flex-1 rounded-full ${s <= step ? 'bg-emerald-500' : 'bg-slate-700'}` }, s))) })] }), step === 1 && (_jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-5 flex flex-col gap-4", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Wallet, { size: 18, color: "#10b981" }), _jsx(Text, { className: "block text-sm font-semibold text-slate-100", children: "\u8BBE\u5B9A\u6295\u5165\u91D1\u989D" })] }), _jsx(View, { className: "bg-slate-900 rounded-xl px-4 py-3", children: _jsx(Input, { type: "digit", value: capital, onInput: (e) => setCapital(e.detail.value), placeholder: "\u8BF7\u8F93\u5165\u6295\u5165\u91D1\u989D\uFF08\u5143\uFF09", style: { width: '100%', backgroundColor: 'transparent', color: '#f1f5f9', fontSize: '18px' } }) }), _jsx(View, { className: "flex flex-row flex-wrap gap-2", children: QUICK_AMOUNTS.map((amount) => (_jsx(View, { onClick: () => setCapital(String(amount)), className: `px-3 py-2 rounded-full border ${Number(capital) === amount
                                        ? 'border-emerald-500 bg-emerald-500 bg-opacity-10'
                                        : 'border-slate-600 bg-slate-900'}`, children: _jsx(Text, { className: `block text-xs ${Number(capital) === amount ? 'text-emerald-400' : 'text-slate-400'}`, children: formatMoney(amount) }) }, amount))) }), _jsx(Button, { className: "w-full bg-emerald-500 text-slate-900 rounded-xl", onClick: () => {
                                    const amount = Number(capital);
                                    if (!Number.isFinite(amount) || amount <= 0) {
                                        Taro.showToast({ title: '请输入有效金额', icon: 'none' });
                                        return;
                                    }
                                    setStep(2);
                                }, children: _jsxs(View, { className: "flex flex-row items-center gap-1", children: [_jsx(Text, { className: "block text-sm font-semibold", children: "\u4E0B\u4E00\u6B65\uFF1A\u5173\u6CE8\u80A1\u7968" }), _jsx(ArrowRight, { size: 14, color: "#0f172a" })] }) })] }) })), step === 2 && (_jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-5 flex flex-col gap-4", children: [_jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Eye, { size: 18, color: "#10b981" }), _jsx(Text, { className: "block text-sm font-semibold text-slate-100", children: "\u9009\u62E9\u5173\u6CE8\u7684\u80A1\u7968" })] }), _jsx(Badge, { variant: "secondary", className: "bg-slate-700 text-slate-300", children: _jsxs(Text, { className: "block text-xs", children: [watchlist.length, " \u53EA"] }) })] }), _jsxs(View, { className: "bg-slate-900 rounded-xl px-4 py-3 flex flex-row items-center gap-2", children: [_jsx(Search, { size: 16, color: "#64748b" }), _jsx(Input, { value: query, onInput: (e) => {
                                            setQuery(e.detail.value);
                                            searchStocks(e.detail.value);
                                        }, placeholder: "\u641C\u7D22\u4EE3\u7801/\u540D\u79F0\uFF0C\u5982 600519 \u6216\u8F93\u5165\u81EA\u5B9A\u4E49\u4EE3\u7801", style: { flex: 1, backgroundColor: 'transparent', color: '#f1f5f9', fontSize: '13px' } }), /^[036][0-9]{5}$/.test(query.trim()) && (_jsxs(View, { onClick: () => addCustomStock(query.trim()), className: "flex flex-row items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500 bg-opacity-10", children: [_jsx(Plus, { size: 12, color: "#10b981" }), _jsx(Text, { className: "block text-xs text-emerald-400", children: "\u81EA\u5B9A\u4E49" })] }))] }), results.length > 0 && (_jsx(View, { className: "flex flex-col gap-2", children: results.map((item) => (_jsxs(View, { onClick: () => addWatch(item.symbol, item.name), className: "flex flex-row items-center justify-between bg-slate-900 rounded-lg px-3 py-2", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-xs text-slate-300", children: item.name }), _jsx(Text, { className: "block text-xs text-slate-500", children: item.symbol }), item.isCustom && (_jsx(Badge, { className: "bg-emerald-500 bg-opacity-20 text-emerald-400", children: _jsx(Text, { className: "block text-[10px]", children: "\u81EA\u5B9A\u4E49" }) }))] }), _jsx(Plus, { size: 14, color: "#10b981" })] }, item.symbol))) })), watchlist.length === 0 ? (_jsx(View, { className: "bg-slate-900 rounded-lg p-4", children: _jsx(Text, { className: "block text-xs text-slate-500 text-center", children: "\u8FD8\u6CA1\u6709\u5173\u6CE8\u7684\u80A1\u7968\uFF0C\u641C\u7D22\u6DFB\u52A0\u4E00\u53EA\u5F00\u59CB\u5427" }) })) : (_jsx(View, { className: "flex flex-col gap-2", children: watchlist.map((item) => (_jsxs(View, { className: "flex flex-row items-center justify-between bg-slate-900 rounded-lg px-3 py-2", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-sm text-slate-100", children: item.name }), _jsx(Text, { className: "block text-xs text-slate-500", children: item.symbol })] }), _jsxs(View, { className: "flex flex-row items-center gap-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-1.5", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u53C2\u4E0E\u6295\u8D44" }), _jsx(Switch, { checked: item.enabled, onCheckedChange: (val) => toggleWatch(item.symbol, val) })] }), _jsx(View, { onClick: () => removeWatch(item.symbol), children: _jsx(Trash2, { size: 14, color: "#ef4444" }) })] })] }, item.symbol))) })), _jsxs(View, { className: "flex flex-row gap-2", children: [_jsx(Button, { variant: "outline", className: "flex-1 bg-slate-900 border-slate-600 text-slate-300 rounded-xl", onClick: () => setStep(1), children: _jsx(Text, { className: "block text-sm", children: "\u4E0A\u4E00\u6B65" }) }), _jsx(Button, { className: "flex-1 bg-emerald-500 text-slate-900 rounded-xl", onClick: () => {
                                            if (watchlist.length === 0) {
                                                Taro.showToast({ title: '至少关注一只股票', icon: 'none' });
                                                return;
                                            }
                                            setStep(3);
                                        }, children: _jsxs(View, { className: "flex flex-row items-center gap-1", children: [_jsx(Text, { className: "block text-sm font-semibold", children: "\u4E0B\u4E00\u6B65\uFF1A\u914D\u7F6E\u7B56\u7565" }), _jsx(ArrowRight, { size: 14, color: "#0f172a" })] }) })] })] }) })), step === 3 && (_jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-5 flex flex-col gap-4", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Brain, { size: 18, color: "#10b981" }), _jsx(Text, { className: "block text-sm font-semibold text-slate-100", children: "\u9009\u62E9\u4EA4\u6613\u7B56\u7565" })] }), _jsx(View, { className: "flex flex-col gap-2", children: strategies.map((s) => (_jsxs(View, { onClick: () => setSelectedStrategyId(s.id), className: `rounded-lg px-3 py-2 border ${selectedStrategyId === s.id
                                        ? 'border-emerald-500 bg-emerald-500 bg-opacity-10'
                                        : 'border-slate-700 bg-slate-900'}`, children: [_jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [selectedStrategyId === s.id && _jsx(CircleCheck, { size: 14, color: "#10b981" }), _jsx(Text, { className: "block text-sm text-slate-100", children: s.name })] }), s.type && (_jsx(Badge, { variant: "secondary", className: "bg-slate-700 text-slate-400", children: _jsx(Text, { className: "block text-[10px]", children: s.type }) }))] }), s.description && (_jsx(Text, { className: "block text-xs text-slate-500 mt-1", children: s.description }))] }, s.id))) }), _jsxs(View, { className: "flex flex-row items-center justify-between bg-slate-900 rounded-lg px-3 py-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Zap, { size: 14, color: "#facc15" }), _jsxs(View, { className: "flex flex-col gap-0.5", children: [_jsx(Text, { className: "block text-sm text-slate-100", children: "\u81EA\u52A8\u4EA4\u6613" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u4FE1\u53F7\u89E6\u53D1\u540E\u81EA\u52A8\u6A21\u62DF\u4E70\u5165/\u5356\u51FA" })] })] }), _jsx(Switch, { checked: autoTrade, onCheckedChange: (val) => setAutoTrade(val) })] }), _jsxs(View, { className: "flex flex-row gap-2", children: [_jsx(Button, { variant: "outline", className: "flex-1 bg-slate-900 border-slate-600 text-slate-300 rounded-xl", onClick: () => setStep(2), children: _jsx(Text, { className: "block text-sm", children: "\u4E0A\u4E00\u6B65" }) }), _jsx(Button, { className: "flex-1 bg-emerald-500 text-slate-900 rounded-xl", disabled: submitting, onClick: finishSetup, children: _jsxs(View, { className: "flex flex-row items-center gap-1", children: [_jsx(TrendingUp, { size: 14, color: "#0f172a" }), _jsx(Text, { className: "block text-sm font-semibold", children: submitting ? '开启中...' : '开启投资' })] }) })] })] }) }))] }) }));
};
export default OnboardingPage;
//# sourceMappingURL=index.js.map