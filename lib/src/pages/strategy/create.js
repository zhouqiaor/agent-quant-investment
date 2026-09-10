import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, Save, Plus, Trash2, TrendingUp, TrendingDown, Target, Activity, Radio, Settings2, CircleAlert, } from 'lucide-react-taro';
const INDICATORS = [
    {
        key: 'MA',
        name: '均线 MA',
        description: '移动平均线，判断趋势方向',
        params: [
            { key: 'period', label: '周期', defaultValue: 20, min: 2, max: 250, step: 1 },
        ],
    },
    {
        key: 'EMA',
        name: '指数均线 EMA',
        description: '指数加权移动平均线，对近期价格更敏感',
        params: [
            { key: 'period', label: '周期', defaultValue: 12, min: 2, max: 250, step: 1 },
        ],
    },
    {
        key: 'MACD',
        name: 'MACD',
        description: '趋势动量指标，金叉/死叉信号',
        params: [
            { key: 'fast', label: '快线', defaultValue: 12, min: 2, max: 50, step: 1 },
            { key: 'slow', label: '慢线', defaultValue: 26, min: 10, max: 100, step: 1 },
            { key: 'signal', label: '信号线', defaultValue: 9, min: 2, max: 50, step: 1 },
        ],
    },
    {
        key: 'RSI',
        name: 'RSI 相对强弱',
        description: '衡量超买/超卖状态',
        params: [
            { key: 'period', label: '周期', defaultValue: 14, min: 2, max: 50, step: 1 },
            { key: 'overbought', label: '超买阈值', defaultValue: 70, min: 50, max: 95, step: 1 },
            { key: 'oversold', label: '超卖阈值', defaultValue: 30, min: 5, max: 50, step: 1 },
        ],
    },
    {
        key: 'BOLL',
        name: '布林带 BOLL',
        description: '价格通道指标，判断波动区间',
        params: [
            { key: 'period', label: '周期', defaultValue: 20, min: 5, max: 100, step: 1 },
            { key: 'stdDev', label: '标准差倍数', defaultValue: 2, min: 1, max: 4, step: 0.5 },
        ],
    },
    {
        key: 'KDJ',
        name: 'KDJ 随机指标',
        description: '短期超买超卖指标',
        params: [
            { key: 'period', label: '周期', defaultValue: 9, min: 2, max: 50, step: 1 },
        ],
    },
    {
        key: 'VOLUME',
        name: '成交量',
        description: '量能分析，确认趋势有效性',
        params: [
            { key: 'maPeriod', label: '量能均线', defaultValue: 20, min: 5, max: 100, step: 1 },
            { key: 'threshold', label: '放量倍数', defaultValue: 1.5, min: 1, max: 5, step: 0.1 },
        ],
    },
];
const OPERATOR_LABELS = {
    cross_above: '上穿',
    cross_below: '下穿',
    above: '大于',
    below: '小于',
    equal: '等于',
    greater: '强于',
    less: '弱于',
};
const StrategyCreatePage = () => {
    const [strategyName, setStrategyName] = useState('');
    const [selectedStock, setSelectedStock] = useState('');
    const [selectedStockInfo, setSelectedStockInfo] = useState(null);
    const [showStockPicker, setShowStockPicker] = useState(false);
    const [addingCustom, setAddingCustom] = useState(false);
    const [stockSearch, setStockSearch] = useState('');
    const [stockSearchResults, setStockSearchResults] = useState([]);
    const [searchingStock, setSearchingStock] = useState(false);
    const [selectedIndicators, setSelectedIndicators] = useState([]);
    const [indicatorParams, setIndicatorParams] = useState({});
    const [buyConditions, setBuyConditions] = useState([]);
    const [sellConditions, setSellConditions] = useState([]);
    const [positionSize, setPositionSize] = useState(10);
    const [stopLoss, setStopLoss] = useState(5);
    const [takeProfit, setTakeProfit] = useState(15);
    const [autoTrade, setAutoTrade] = useState(false);
    const [saving, setSaving] = useState(false);
    const [monitorEnabled, setMonitorEnabled] = useState(true);
    // Agent 分析
    const [agentAnalysis, setAgentAnalysis] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    // 编辑模式
    const [editId, setEditId] = useState(null);
    useEffect(() => {
        var _a;
        const pages = Taro.getCurrentPages();
        const currentPage = pages[pages.length - 1];
        const id = (_a = currentPage === null || currentPage === void 0 ? void 0 : currentPage.options) === null || _a === void 0 ? void 0 : _a.id;
        if (id) {
            setEditId(id);
            loadStrategy(id);
        }
    }, []);
    const loadStrategy = async (id) => {
        var _a;
        try {
            const res = await Network.request({ url: `/api/strategies/custom/${id}` });
            console.log('load strategy:', res.data);
            const data = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            if (data) {
                setStrategyName(data.name);
                setSelectedStock(data.symbol);
                setSelectedIndicators(data.indicators || []);
                setIndicatorParams(data.indicatorParams || {});
                setBuyConditions(data.buyConditions || []);
                setSellConditions(data.sellConditions || []);
                setPositionSize(data.positionSize || 10);
                setStopLoss(data.stopLoss || 5);
                setTakeProfit(data.takeProfit || 15);
                setAutoTrade(data.autoTrade || false);
                setMonitorEnabled(data.monitorEnabled !== false);
            }
        }
        catch (e) {
            console.error('loadStrategy error:', e);
        }
    };
    const toggleIndicator = (key) => {
        setSelectedIndicators((prev) => {
            if (prev.includes(key)) {
                const next = prev.filter((k) => k !== key);
                const newParams = Object.assign({}, indicatorParams);
                delete newParams[key];
                setIndicatorParams(newParams);
                return next;
            }
            const def = INDICATORS.find((i) => i.key === key);
            if (def) {
                const defaults = {};
                def.params.forEach((p) => {
                    defaults[p.key] = p.defaultValue;
                });
                setIndicatorParams(Object.assign(Object.assign({}, indicatorParams), { [key]: defaults }));
            }
            return [...prev, key];
        });
    };
    const updateParam = (indicatorKey, paramKey, value) => {
        setIndicatorParams((prev) => (Object.assign(Object.assign({}, prev), { [indicatorKey]: Object.assign(Object.assign({}, prev[indicatorKey]), { [paramKey]: value }) })));
    };
    const addCondition = (type) => {
        const newCondition = {
            id: `c_${Date.now()}`,
            indicator: selectedIndicators[0] || 'MA',
            operator: type === 'buy' ? 'cross_below' : 'cross_above',
            value: 0,
            description: '',
        };
        if (type === 'buy') {
            setBuyConditions([...buyConditions, newCondition]);
        }
        else {
            setSellConditions([...sellConditions, newCondition]);
        }
    };
    const removeCondition = (type, id) => {
        if (type === 'buy') {
            setBuyConditions(buyConditions.filter((c) => c.id !== id));
        }
        else {
            setSellConditions(sellConditions.filter((c) => c.id !== id));
        }
    };
    const updateCondition = (type, id, field, value) => {
        const updater = (conditions) => conditions.map((c) => (c.id === id ? Object.assign(Object.assign({}, c), { [field]: value }) : c));
        if (type === 'buy') {
            setBuyConditions(updater(buyConditions));
        }
        else {
            setSellConditions(updater(sellConditions));
        }
    };
    // 搜索股票（调用后端API）
    const searchStocks = async (query) => {
        var _a;
        setStockSearch(query);
        if (!query.trim()) {
            setStockSearchResults([]);
            return;
        }
        setSearchingStock(true);
        try {
            const res = await Network.request({ url: '/api/stock/search', data: { q: query }, method: 'GET' });
            console.log('search stocks:', res.data);
            const data = ((_a = res.data) === null || _a === void 0 ? void 0 : _a.data) || [];
            setStockSearchResults(data);
        }
        catch (e) {
            console.error('searchStocks error:', e);
        }
        finally {
            setSearchingStock(false);
        }
    };
    // 防抖搜索
    let searchTimer = null;
    const searchStocksDebounced = (query) => {
        if (searchTimer)
            clearTimeout(searchTimer);
        searchTimer = setTimeout(() => searchStocks(query), 300);
    };
    // 添加为自定义股票（A股6位代码），成功后自动选中新股票
    const canAddCustom = /^\d{6}$/.test(stockSearch.trim()) &&
        !stockSearchResults.some((s) => s.symbol === stockSearch.trim()) &&
        !addingCustom;
    const handleAddCustomStock = async () => {
        var _a, _b, _c;
        const symbol = stockSearch.trim();
        if (!/^\d{6}$/.test(symbol)) {
            Taro.showToast({ title: '仅支持A股6位代码', icon: 'none' });
            return;
        }
        setAddingCustom(true);
        try {
            const res = await Network.request({
                url: '/api/stock/custom',
                method: 'POST',
                data: { symbol },
            });
            console.log('add custom stock:', res.data);
            if (((_a = res.data) === null || _a === void 0 ? void 0 : _a.code) !== 200) {
                Taro.showToast({ title: ((_b = res.data) === null || _b === void 0 ? void 0 : _b.msg) || '添加失败', icon: 'none' });
                return;
            }
            const stock = (_c = res.data) === null || _c === void 0 ? void 0 : _c.data;
            Taro.showToast({ title: `已添加 ${(stock === null || stock === void 0 ? void 0 : stock.name) || symbol}`, icon: 'success' });
            setShowStockPicker(false);
            if (stock) {
                setSelectedStock(stock.symbol);
                setSelectedStockInfo(Object.assign(Object.assign({}, stock), { industry: stock.industry || '自定义' }));
            }
            setStockSearch('');
            setStockSearchResults([]);
        }
        catch (e) {
            console.error('addCustomStock error:', e);
            Taro.showToast({ title: '添加失败', icon: 'none' });
        }
        finally {
            setAddingCustom(false);
        }
    };
    // Agent 分析
    const runAgentAnalysis = async () => {
        var _a;
        if (!selectedStock)
            return;
        setAnalyzing(true);
        setShowAnalysis(true);
        try {
            const res = await Network.request({ url: '/api/agent-analysis/analyze', data: { symbol: selectedStock }, method: 'GET' });
            console.log('agent analysis:', res.data);
            const data = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data;
            if (data) {
                setAgentAnalysis(data);
            }
        }
        catch (e) {
            console.error('agentAnalysis error:', e);
            Taro.showToast({ title: '分析失败，请重试', icon: 'none' });
        }
        finally {
            setAnalyzing(false);
        }
    };
    const handleSave = async () => {
        var _a;
        if (!strategyName.trim()) {
            Taro.showToast({ title: '请输入策略名称', icon: 'none' });
            return;
        }
        if (!selectedStock) {
            Taro.showToast({ title: '请选择股票标的', icon: 'none' });
            return;
        }
        if (selectedIndicators.length === 0) {
            Taro.showToast({ title: '请至少选择一个技术指标', icon: 'none' });
            return;
        }
        if (buyConditions.length === 0 && sellConditions.length === 0) {
            Taro.showToast({ title: '请至少设置一个买卖条件', icon: 'none' });
            return;
        }
        setSaving(true);
        try {
            const payload = {
                id: editId || undefined,
                name: strategyName,
                symbol: selectedStock,
                indicators: selectedIndicators,
                indicatorParams,
                buyConditions,
                sellConditions,
                positionSize,
                stopLoss,
                takeProfit,
                autoTrade,
                monitorEnabled,
            };
            const url = editId ? '/api/strategies/custom' : '/api/strategies/custom';
            const method = editId ? 'PUT' : 'POST';
            const res = await Network.request({ url, method, data: payload });
            console.log('save strategy:', res.data);
            if (((_a = res.data) === null || _a === void 0 ? void 0 : _a.code) === 200) {
                Taro.showToast({ title: editId ? '策略已更新' : '策略已创建', icon: 'success' });
                setTimeout(() => Taro.navigateBack(), 1500);
            }
        }
        catch (e) {
            console.error('saveStrategy error:', e);
            Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
        }
        finally {
            setSaving(false);
        }
    };
    const stockInfo = selectedStockInfo;
    return (_jsx(ScrollView, { scrollY: true, className: "h-full bg-slate-900", children: _jsxs(View, { className: "px-4 pb-24 gap-4 flex flex-col", children: [_jsxs(View, { className: "flex flex-row items-center gap-3 mt-4", children: [_jsx(View, { className: "flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800", onClick: () => Taro.navigateBack(), children: _jsx(ChevronLeft, { size: 20, color: "#e2e8f0" }) }), _jsx(Text, { className: "block text-lg font-bold text-slate-100", children: editId ? '编辑策略' : '创建自定义策略' })] }), _jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center gap-2 mb-3", children: [_jsx(Settings2, { size: 18, color: "#10b981" }), _jsx(Text, { className: "block text-sm font-bold text-slate-100", children: "\u57FA\u672C\u4FE1\u606F" })] }), _jsxs(View, { className: "flex flex-col gap-3", children: [_jsxs(View, { className: "flex flex-col gap-2", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u7B56\u7565\u540D\u79F0" }), _jsx(View, { className: "bg-slate-900 rounded-lg px-3 py-2", children: _jsx(Input, { className: "w-full bg-transparent text-slate-100", placeholder: "\u8F93\u5165\u7B56\u7565\u540D\u79F0\uFF0C\u5982\uFF1AMACD\u91D1\u53C9+\u653E\u91CF\u786E\u8BA4", value: strategyName, onInput: (e) => setStrategyName(e.detail.value) }) })] }), _jsxs(View, { className: "flex flex-col gap-2", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u80A1\u7968\u6807\u7684\uFF08\u652F\u6301A\u80A1/\u6E2F\u80A1/\u7F8E\u80A1\u641C\u7D22\uFF09" }), _jsx(View, { className: "bg-slate-900 rounded-lg px-3 py-2", children: _jsx(Input, { className: "w-full bg-transparent text-slate-100", placeholder: "\u8F93\u5165\u80A1\u7968\u4EE3\u7801\u6216\u540D\u79F0\u641C\u7D22\uFF0C\u5982\uFF1A\u8305\u53F0\u3001600519\u3001AAPL", value: stockSearch, onInput: (e) => {
                                                        const val = e.detail.value;
                                                        setStockSearch(val);
                                                        if (val.trim()) {
                                                            searchStocksDebounced(val);
                                                        }
                                                        else {
                                                            setStockSearchResults([]);
                                                        }
                                                    }, onFocus: () => setShowStockPicker(true) }) }), selectedStock && selectedStockInfo && (_jsxs(View, { className: "bg-emerald-500 bg-opacity-10 border border-emerald-500 border-opacity-30 rounded-lg p-3 flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-sm font-bold text-slate-100", children: selectedStockInfo.name }), _jsx(Badge, { className: `${selectedStockInfo.market === 'A' ? 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30' :
                                                                            selectedStockInfo.market === 'HK' ? 'bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30' :
                                                                                'bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30'}`, children: selectedStockInfo.market }), _jsx(Text, { className: "block text-xs text-slate-500", children: selectedStockInfo.symbol })] }), _jsxs(View, { className: "flex flex-row items-center gap-3", children: [_jsxs(Text, { className: "block text-xs text-slate-400", children: ["\u00A5", selectedStockInfo.price.toFixed(2)] }), _jsxs(Text, { className: `block text-xs font-medium ${selectedStockInfo.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [selectedStockInfo.changePercent >= 0 ? '+' : '', selectedStockInfo.changePercent.toFixed(2), "%"] }), _jsxs(Text, { className: "block text-xs text-slate-500", children: ["PE:", selectedStockInfo.pe] }), _jsx(Text, { className: "block text-xs text-slate-500", children: selectedStockInfo.industry })] })] }), _jsx(View, { className: "flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800", onClick: () => {
                                                            setSelectedStock('');
                                                            setSelectedStockInfo(null);
                                                            setAgentAnalysis(null);
                                                        }, children: _jsx(Trash2, { size: 14, color: "#ef4444" }) })] })), showStockPicker && stockSearchResults.length > 0 && (_jsx(View, { className: "bg-slate-900 rounded-lg p-3 flex flex-col gap-2", children: _jsx(ScrollView, { scrollY: true, className: "max-h-48", children: _jsx(View, { className: "flex flex-col gap-1", children: stockSearchResults.map((s) => (_jsx(View, { className: `flex flex-row items-center justify-between px-3 py-2 rounded-lg ${selectedStock === s.symbol
                                                                ? 'bg-emerald-500 bg-opacity-20'
                                                                : 'bg-slate-800'}`, onClick: () => {
                                                                setSelectedStock(s.symbol);
                                                                setSelectedStockInfo(s);
                                                                setShowStockPicker(false);
                                                                setStockSearch('');
                                                                setStockSearchResults([]);
                                                                setAgentAnalysis(null);
                                                            }, children: _jsxs(View, { className: "flex flex-col gap-1", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-sm text-slate-100", children: s.name }), _jsx(Badge, { className: `${s.market === 'A' ? 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30' :
                                                                                    s.market === 'HK' ? 'bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30' :
                                                                                        'bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30'}`, children: s.market }), s.isCustom && (_jsx(Badge, { className: "bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-30", children: "\u81EA\u5B9A\u4E49" })), _jsx(Text, { className: "block text-xs text-slate-500", children: s.industry })] }), _jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: s.symbol }), _jsxs(Text, { className: "block text-xs text-slate-400", children: ["\u00A5", s.price.toFixed(2)] }), _jsxs(Text, { className: `block text-xs ${s.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`, children: [s.changePercent >= 0 ? '+' : '', s.changePercent.toFixed(2), "%"] })] })] }) }, s.symbol))) }) }) })), canAddCustom && (_jsxs(View, { className: "flex flex-row items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-emerald-500 border-opacity-40 bg-emerald-500 bg-opacity-5", onClick: handleAddCustomStock, children: [_jsx(Plus, { size: 14, color: "#34d399" }), _jsx(Text, { className: "block text-xs text-emerald-400", children: addingCustom ? '添加中...' : `将 ${stockSearch.trim()} 添加为自定义股票` })] })), searchingStock && (_jsx(Text, { className: "block text-xs text-slate-500", children: "\u641C\u7D22\u4E2D..." }))] })] })] }) }), selectedStock && (_jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center justify-between mb-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Radio, { size: 18, color: "#a855f7" }), _jsx(Text, { className: "block text-sm font-bold text-slate-100", children: "Agent \u667A\u80FD\u5206\u6790" })] }), _jsx(Button, { className: "bg-purple-500 bg-opacity-20 text-purple-400 h-7 px-3", onClick: runAgentAnalysis, children: analyzing ? (_jsx(Text, { className: "text-xs", children: "\u5206\u6790\u4E2D..." })) : (_jsx(Text, { className: "text-xs", children: agentAnalysis ? '重新分析' : '开始分析' })) })] }), analyzing && (_jsxs(View, { className: "flex items-center justify-center py-6", children: [_jsx(View, { className: "w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent", style: { animation: 'spin 1s linear infinite' } }), _jsx(Text, { className: "block text-xs text-slate-400 mt-3", children: "Agent \u6B63\u5728\u8FDB\u884C\u591A\u7EF4\u5EA6\u5206\u6790..." })] })), agentAnalysis && !analyzing && (_jsxs(View, { className: "flex flex-col gap-3", children: [_jsxs(View, { className: "bg-slate-900 rounded-lg p-3 flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u7EFC\u5408\u8BC4\u5206" }), _jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: `block text-2xl font-bold ${agentAnalysis.overallScore >= 70 ? 'text-green-400' :
                                                                    agentAnalysis.overallScore >= 50 ? 'text-amber-400' : 'text-red-400'}`, children: agentAnalysis.overallScore }), _jsx(Badge, { className: `${agentAnalysis.overallSignal === 'strong_buy' || agentAnalysis.overallSignal === 'buy'
                                                                    ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30'
                                                                    : agentAnalysis.overallSignal === 'neutral'
                                                                        ? 'bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30'
                                                                        : 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30'}`, children: agentAnalysis.overallSignal === 'strong_buy' ? '强烈买入' :
                                                                    agentAnalysis.overallSignal === 'buy' ? '买入' :
                                                                        agentAnalysis.overallSignal === 'neutral' ? '中性' :
                                                                            agentAnalysis.overallSignal === 'sell' ? '卖出' : '强烈卖出' })] })] }), _jsxs(View, { className: "flex flex-col items-end gap-1", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u5EFA\u8BAE\u64CD\u4F5C" }), _jsx(Text, { className: `block text-sm font-bold ${agentAnalysis.actionPlan.action === 'buy' ? 'text-green-400' :
                                                            agentAnalysis.actionPlan.action === 'sell' ? 'text-red-400' :
                                                                agentAnalysis.actionPlan.action === 'reduce' ? 'text-orange-400' : 'text-slate-400'}`, children: agentAnalysis.actionPlan.action === 'buy' ? '买入' :
                                                            agentAnalysis.actionPlan.action === 'sell' ? '卖出' :
                                                                agentAnalysis.actionPlan.action === 'reduce' ? '减仓' : '持仓观望' }), _jsxs(Text, { className: "block text-xs text-slate-500", children: ["\u7F6E\u4FE1\u5EA6 ", agentAnalysis.actionPlan.confidence, "%"] })] })] }), _jsxs(View, { className: "flex flex-row gap-2", children: [_jsxs(View, { className: "flex-1 bg-slate-900 rounded-lg p-2 flex flex-col items-center", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u6280\u672F\u9762" }), _jsx(Text, { className: `block text-lg font-bold ${agentAnalysis.technical.score >= 60 ? 'text-green-400' :
                                                            agentAnalysis.technical.score <= 40 ? 'text-red-400' : 'text-amber-400'}`, children: agentAnalysis.technical.score })] }), _jsxs(View, { className: "flex-1 bg-slate-900 rounded-lg p-2 flex flex-col items-center", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u57FA\u672C\u9762" }), _jsx(Text, { className: `block text-lg font-bold ${agentAnalysis.fundamental.score >= 60 ? 'text-green-400' :
                                                            agentAnalysis.fundamental.score <= 40 ? 'text-red-400' : 'text-amber-400'}`, children: agentAnalysis.fundamental.score })] }), _jsxs(View, { className: "flex-1 bg-slate-900 rounded-lg p-2 flex flex-col items-center", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u8D44\u91D1\u9762" }), _jsx(Text, { className: `block text-lg font-bold ${agentAnalysis.capitalFlow.score >= 60 ? 'text-green-400' :
                                                            agentAnalysis.capitalFlow.score <= 40 ? 'text-red-400' : 'text-amber-400'}`, children: agentAnalysis.capitalFlow.score })] }), _jsxs(View, { className: "flex-1 bg-slate-900 rounded-lg p-2 flex flex-col items-center", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: "\u6D88\u606F\u9762" }), _jsx(Text, { className: `block text-lg font-bold ${agentAnalysis.sentiment.score >= 60 ? 'text-green-400' :
                                                            agentAnalysis.sentiment.score <= 40 ? 'text-red-400' : 'text-amber-400'}`, children: agentAnalysis.sentiment.score })] })] }), _jsxs(View, { className: "bg-slate-900 rounded-lg p-3", children: [_jsx(Text, { className: "block text-xs text-slate-400 mb-2", children: "Agent \u5EFA\u8BAE" }), _jsx(Text, { className: "block text-xs text-slate-300 leading-5", children: agentAnalysis.recommendation }), _jsx(Text, { className: "block text-xs text-slate-500 mt-2", children: agentAnalysis.actionPlan.reason }), agentAnalysis.actionPlan.targetPrice > 0 && (_jsxs(View, { className: "flex flex-row gap-4 mt-2", children: [_jsxs(Text, { className: "block text-xs text-green-400", children: ["\u76EE\u6807\u4EF7: \u00A5", agentAnalysis.actionPlan.targetPrice.toFixed(2)] }), _jsxs(Text, { className: "block text-xs text-red-400", children: ["\u6B62\u635F\u4EF7: \u00A5", agentAnalysis.actionPlan.stopLoss.toFixed(2)] }), agentAnalysis.actionPlan.positionSize > 0 && (_jsxs(Text, { className: "block text-xs text-amber-400", children: ["\u5EFA\u8BAE\u4ED3\u4F4D: ", agentAnalysis.actionPlan.positionSize, "%"] }))] }))] }), showAnalysis && (_jsxs(View, { className: "flex flex-col gap-2", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6280\u672F\u6307\u6807\u4FE1\u53F7" }), _jsx(View, { className: "flex flex-col gap-1", children: agentAnalysis.technical.indicators.map((ind, idx) => (_jsxs(View, { className: "flex flex-row items-center justify-between bg-slate-900 rounded px-3 py-2", children: [_jsx(Text, { className: "block text-xs text-slate-300", children: ind.name }), _jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: ind.value }), _jsx(Badge, { className: `${ind.signal === 'buy' ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30' :
                                                                        ind.signal === 'sell' ? 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30' :
                                                                            'bg-slate-700 text-slate-400 border-slate-600'}`, children: ind.signal === 'buy' ? '买入' : ind.signal === 'sell' ? '卖出' : '中性' })] })] }, idx))) }), _jsx(Text, { className: "block text-xs text-slate-400 mt-2", children: "\u57FA\u672C\u9762\u6307\u6807" }), _jsx(View, { className: "flex flex-col gap-1", children: agentAnalysis.fundamental.metrics.map((m, idx) => (_jsxs(View, { className: "flex flex-row items-center justify-between bg-slate-900 rounded px-3 py-2", children: [_jsx(Text, { className: "block text-xs text-slate-300", children: m.name }), _jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: m.value }), _jsx(Badge, { className: `${m.rating === 'excellent' ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30' :
                                                                        m.rating === 'good' ? 'bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30' :
                                                                            m.rating === 'fair' ? 'bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30' :
                                                                                'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30'}`, children: m.rating === 'excellent' ? '优秀' : m.rating === 'good' ? '良好' : m.rating === 'fair' ? '一般' : '较差' })] })] }, idx))) }), _jsx(Text, { className: "block text-xs text-slate-400 mt-2", children: "\u8FD1\u671F\u6D88\u606F" }), _jsx(View, { className: "flex flex-col gap-1", children: agentAnalysis.sentiment.news.map((n, idx) => (_jsxs(View, { className: "flex flex-row items-center justify-between bg-slate-900 rounded px-3 py-2", children: [_jsx(Text, { className: "block text-xs text-slate-300 flex-1", children: n.title }), _jsxs(View, { className: "flex flex-row items-center gap-2 ml-2", children: [_jsx(Text, { className: "block text-xs text-slate-500", children: n.time }), _jsx(Badge, { className: `${n.sentiment === 'positive' ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30' :
                                                                        n.sentiment === 'negative' ? 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30' :
                                                                            'bg-slate-700 text-slate-400 border-slate-600'}`, children: n.sentiment === 'positive' ? '利好' : n.sentiment === 'negative' ? '利空' : '中性' })] })] }, idx))) })] })), _jsx(View, { className: "flex items-center py-2", onClick: () => setShowAnalysis(!showAnalysis), children: _jsx(Text, { className: "block text-xs text-purple-400", children: showAnalysis ? '收起详情' : '展开详情' }) })] }))] }) })), _jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center gap-2 mb-3", children: [_jsx(Activity, { size: 18, color: "#3b82f6" }), _jsx(Text, { className: "block text-sm font-bold text-slate-100", children: "\u6280\u672F\u6307\u6807" }), _jsxs(Text, { className: "block text-xs text-slate-500 ml-2", children: ["\u5DF2\u9009 ", selectedIndicators.length, " \u4E2A"] })] }), _jsx(View, { className: "flex flex-col gap-2", children: INDICATORS.map((ind) => {
                                    const isSelected = selectedIndicators.includes(ind.key);
                                    return (_jsxs(View, { children: [_jsxs(View, { className: `flex flex-row items-center justify-between px-3 py-3 rounded-lg border ${isSelected
                                                    ? 'bg-blue-500 bg-opacity-10 border-blue-500 border-opacity-30'
                                                    : 'bg-slate-900 border-slate-700'}`, onClick: () => toggleIndicator(ind.key), children: [_jsxs(View, { className: "flex flex-col gap-1 flex-1", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-sm font-semibold text-slate-100", children: ind.name }), isSelected && (_jsx(Badge, { className: "bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30", children: "\u5DF2\u9009" }))] }), _jsx(Text, { className: "block text-xs text-slate-500", children: ind.description })] }), _jsx(View, { className: `w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`, children: isSelected && _jsx(Text, { className: "block text-xs text-white", children: "\u2713" }) })] }), isSelected && (_jsx(View, { className: "flex flex-col gap-2 mt-2 ml-3 mb-2", children: ind.params.map((p) => {
                                                    var _a, _b;
                                                    return (_jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: p.label }), _jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(View, { className: "w-7 h-7 rounded bg-slate-700 flex items-center justify-center", onClick: () => {
                                                                            var _a, _b;
                                                                            const cur = (_b = (_a = indicatorParams[ind.key]) === null || _a === void 0 ? void 0 : _a[p.key]) !== null && _b !== void 0 ? _b : p.defaultValue;
                                                                            if (cur > p.min)
                                                                                updateParam(ind.key, p.key, cur - p.step);
                                                                        }, children: _jsx(Text, { className: "block text-sm text-slate-300", children: "-" }) }), _jsx(Text, { className: "block text-sm font-mono text-slate-100 w-10 text-center", children: (_b = (_a = indicatorParams[ind.key]) === null || _a === void 0 ? void 0 : _a[p.key]) !== null && _b !== void 0 ? _b : p.defaultValue }), _jsx(View, { className: "w-7 h-7 rounded bg-slate-700 flex items-center justify-center", onClick: () => {
                                                                            var _a, _b;
                                                                            const cur = (_b = (_a = indicatorParams[ind.key]) === null || _a === void 0 ? void 0 : _a[p.key]) !== null && _b !== void 0 ? _b : p.defaultValue;
                                                                            if (cur < p.max)
                                                                                updateParam(ind.key, p.key, +(cur + p.step).toFixed(2));
                                                                        }, children: _jsx(Text, { className: "block text-sm text-slate-300", children: "+" }) })] })] }, p.key));
                                                }) }))] }, ind.key));
                                }) })] }) }), _jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center justify-between mb-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(TrendingUp, { size: 18, color: "#22c55e" }), _jsx(Text, { className: "block text-sm font-bold text-slate-100", children: "\u4E70\u5165\u6761\u4EF6" })] }), selectedIndicators.length > 0 && (_jsxs(Button, { className: "bg-green-500 bg-opacity-20 text-green-400 h-7 px-3", onClick: () => addCondition('buy'), children: [_jsx(Plus, { size: 14, color: "#4ade80" }), _jsx(Text, { className: "text-xs ml-1", children: "\u6DFB\u52A0" })] }))] }), buyConditions.length === 0 ? (_jsx(View, { className: "flex items-center justify-center py-4", children: _jsx(Text, { className: "block text-xs text-slate-500", children: "\u8BF7\u5148\u9009\u62E9\u6280\u672F\u6307\u6807\uFF0C\u7136\u540E\u6DFB\u52A0\u4E70\u5165\u6761\u4EF6" }) })) : (_jsx(View, { className: "flex flex-col gap-2", children: buyConditions.map((c, idx) => {
                                    var _a;
                                    return (_jsxs(View, { className: "bg-slate-900 rounded-lg p-3 flex flex-col gap-2", children: [_jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(Text, { className: "block text-xs text-green-400 font-medium", children: ["\u6761\u4EF6 ", idx + 1] }), _jsx(View, { onClick: () => removeCondition('buy', c.id), children: _jsx(Trash2, { size: 14, color: "#ef4444" }) })] }), _jsxs(View, { className: "flex flex-row gap-2", children: [_jsx(View, { className: "flex-1 bg-slate-800 rounded px-2 py-2", children: _jsxs(View, { className: "flex flex-row items-center justify-between", onClick: () => {
                                                                const curIdx = selectedIndicators.indexOf(c.indicator);
                                                                const nextIdx = (curIdx + 1) % selectedIndicators.length;
                                                                updateCondition('buy', c.id, 'indicator', selectedIndicators[nextIdx]);
                                                            }, children: [_jsx(Text, { className: "block text-xs text-slate-100", children: ((_a = INDICATORS.find((i) => i.key === c.indicator)) === null || _a === void 0 ? void 0 : _a.name) || c.indicator }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u5207\u6362" })] }) }), _jsx(View, { className: "flex-1 bg-slate-800 rounded px-2 py-2", children: _jsxs(View, { className: "flex flex-row items-center justify-between", onClick: () => {
                                                                const ops = Object.keys(OPERATOR_LABELS);
                                                                const curIdx = ops.indexOf(c.operator);
                                                                const nextOp = ops[(curIdx + 1) % ops.length];
                                                                updateCondition('buy', c.id, 'operator', nextOp);
                                                            }, children: [_jsx(Text, { className: "block text-xs text-slate-100", children: OPERATOR_LABELS[c.operator] }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u5207\u6362" })] }) })] })] }, c.id));
                                }) }))] }) }), _jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center justify-between mb-3", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(TrendingDown, { size: 18, color: "#ef4444" }), _jsx(Text, { className: "block text-sm font-bold text-slate-100", children: "\u5356\u51FA\u6761\u4EF6" })] }), selectedIndicators.length > 0 && (_jsxs(Button, { className: "bg-red-500 bg-opacity-20 text-red-400 h-7 px-3", onClick: () => addCondition('sell'), children: [_jsx(Plus, { size: 14, color: "#f87171" }), _jsx(Text, { className: "text-xs ml-1", children: "\u6DFB\u52A0" })] }))] }), sellConditions.length === 0 ? (_jsx(View, { className: "flex items-center justify-center py-4", children: _jsx(Text, { className: "block text-xs text-slate-500", children: "\u8BF7\u5148\u9009\u62E9\u6280\u672F\u6307\u6807\uFF0C\u7136\u540E\u6DFB\u52A0\u5356\u51FA\u6761\u4EF6" }) })) : (_jsx(View, { className: "flex flex-col gap-2", children: sellConditions.map((c, idx) => {
                                    var _a;
                                    return (_jsxs(View, { className: "bg-slate-900 rounded-lg p-3 flex flex-col gap-2", children: [_jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(Text, { className: "block text-xs text-red-400 font-medium", children: ["\u6761\u4EF6 ", idx + 1] }), _jsx(View, { onClick: () => removeCondition('sell', c.id), children: _jsx(Trash2, { size: 14, color: "#ef4444" }) })] }), _jsxs(View, { className: "flex flex-row gap-2", children: [_jsx(View, { className: "flex-1 bg-slate-800 rounded px-2 py-2", children: _jsxs(View, { className: "flex flex-row items-center justify-between", onClick: () => {
                                                                const curIdx = selectedIndicators.indexOf(c.indicator);
                                                                const nextIdx = (curIdx + 1) % selectedIndicators.length;
                                                                updateCondition('sell', c.id, 'indicator', selectedIndicators[nextIdx]);
                                                            }, children: [_jsx(Text, { className: "block text-xs text-slate-100", children: ((_a = INDICATORS.find((i) => i.key === c.indicator)) === null || _a === void 0 ? void 0 : _a.name) || c.indicator }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u5207\u6362" })] }) }), _jsx(View, { className: "flex-1 bg-slate-800 rounded px-2 py-2", children: _jsxs(View, { className: "flex flex-row items-center justify-between", onClick: () => {
                                                                const ops = Object.keys(OPERATOR_LABELS);
                                                                const curIdx = ops.indexOf(c.operator);
                                                                const nextOp = ops[(curIdx + 1) % ops.length];
                                                                updateCondition('sell', c.id, 'operator', nextOp);
                                                            }, children: [_jsx(Text, { className: "block text-xs text-slate-100", children: OPERATOR_LABELS[c.operator] }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u5207\u6362" })] }) })] })] }, c.id));
                                }) }))] }) }), _jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center gap-2 mb-3", children: [_jsx(Target, { size: 18, color: "#f59e0b" }), _jsx(Text, { className: "block text-sm font-bold text-slate-100", children: "\u98CE\u63A7\u53C2\u6570" })] }), _jsxs(View, { className: "flex flex-col gap-3", children: [_jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u4ED3\u4F4D\u6BD4\u4F8B" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u5355\u6B21\u4EA4\u6613\u5360\u603B\u8D44\u91D1\u6BD4\u4F8B" })] }), _jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(View, { className: "w-7 h-7 rounded bg-slate-700 flex items-center justify-center", onClick: () => setPositionSize(Math.max(1, positionSize - 1)), children: _jsx(Text, { className: "block text-sm text-slate-300", children: "-" }) }), _jsxs(Text, { className: "block text-sm font-mono text-slate-100 w-12 text-center", children: [positionSize, "%"] }), _jsx(View, { className: "w-7 h-7 rounded bg-slate-700 flex items-center justify-center", onClick: () => setPositionSize(Math.min(100, positionSize + 1)), children: _jsx(Text, { className: "block text-sm text-slate-300", children: "+" }) })] })] }), _jsx(Separator, { className: "bg-slate-700" }), _jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6B62\u635F\u6BD4\u4F8B" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u4E8F\u635F\u8FBE\u5230\u6B64\u6BD4\u4F8B\u81EA\u52A8\u5E73\u4ED3" })] }), _jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(View, { className: "w-7 h-7 rounded bg-slate-700 flex items-center justify-center", onClick: () => setStopLoss(Math.max(1, stopLoss - 1)), children: _jsx(Text, { className: "block text-sm text-slate-300", children: "-" }) }), _jsxs(Text, { className: "block text-sm font-mono text-red-400 w-12 text-center", children: [stopLoss, "%"] }), _jsx(View, { className: "w-7 h-7 rounded bg-slate-700 flex items-center justify-center", onClick: () => setStopLoss(Math.min(50, stopLoss + 1)), children: _jsx(Text, { className: "block text-sm text-slate-300", children: "+" }) })] })] }), _jsx(Separator, { className: "bg-slate-700" }), _jsxs(View, { className: "flex flex-row items-center justify-between", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-xs text-slate-400", children: "\u6B62\u76C8\u6BD4\u4F8B" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u76C8\u5229\u8FBE\u5230\u6B64\u6BD4\u4F8B\u81EA\u52A8\u5E73\u4ED3" })] }), _jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(View, { className: "w-7 h-7 rounded bg-slate-700 flex items-center justify-center", onClick: () => setTakeProfit(Math.max(2, takeProfit - 1)), children: _jsx(Text, { className: "block text-sm text-slate-300", children: "-" }) }), _jsxs(Text, { className: "block text-sm font-mono text-green-400 w-12 text-center", children: [takeProfit, "%"] }), _jsx(View, { className: "w-7 h-7 rounded bg-slate-700 flex items-center justify-center", onClick: () => setTakeProfit(Math.min(100, takeProfit + 1)), children: _jsx(Text, { className: "block text-sm text-slate-300", children: "+" }) })] })] })] })] }) }), _jsx(Card, { className: "bg-slate-800 border-slate-700", children: _jsxs(CardContent, { className: "p-4", children: [_jsxs(View, { className: "flex flex-row items-center gap-2 mb-3", children: [_jsx(Radio, { size: 18, color: "#8b5cf6" }), _jsx(Text, { className: "block text-sm font-bold text-slate-100", children: "\u76D1\u542C\u4E0E\u6267\u884C" })] }), _jsxs(View, { className: "flex flex-col gap-3", children: [_jsxs(View, { className: "flex flex-row items-center justify-between bg-slate-900 rounded-lg p-3", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-sm text-slate-100", children: "\u884C\u60C5\u76D1\u542C" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u5B9E\u65F6\u76D1\u63A7\u884C\u60C5\u6570\u636E\uFF0C\u89E6\u53D1\u6761\u4EF6\u65F6\u751F\u6210\u4FE1\u53F7" })] }), _jsx(Switch, { checked: monitorEnabled, onCheckedChange: setMonitorEnabled })] }), _jsxs(View, { className: "flex flex-row items-center justify-between bg-slate-900 rounded-lg p-3", children: [_jsxs(View, { className: "flex flex-col gap-1", children: [_jsx(Text, { className: "block text-sm text-slate-100", children: "\u81EA\u52A8\u4EA4\u6613" }), _jsx(Text, { className: "block text-xs text-slate-500", children: "\u4FE1\u53F7\u89E6\u53D1\u540E\u81EA\u52A8\u6267\u884C\u4E70\u5356\u64CD\u4F5C" })] }), _jsx(Switch, { checked: autoTrade, onCheckedChange: setAutoTrade })] }), autoTrade && (_jsxs(View, { className: "flex flex-row items-center gap-2 bg-amber-500 bg-opacity-10 border border-amber-500 border-opacity-30 rounded-lg p-3", children: [_jsx(CircleAlert, { size: 16, color: "#f59e0b" }), _jsx(Text, { className: "block text-xs text-amber-400 flex-1", children: "\u81EA\u52A8\u4EA4\u6613\u5C06\u6839\u636E\u914D\u7F6E\u7684\u98CE\u63A7\u53C2\u6570\u6267\u884C\uFF0C\u8BF7\u786E\u4FDD\u53C2\u6570\u8BBE\u7F6E\u5408\u7406" })] }))] })] }) }), strategyName && selectedStock && selectedIndicators.length > 0 && (_jsx(Card, { className: "bg-slate-800 border-emerald-500 border-opacity-30", children: _jsxs(CardContent, { className: "p-4", children: [_jsx(Text, { className: "block text-xs text-slate-400 mb-2", children: "\u7B56\u7565\u9884\u89C8" }), _jsxs(View, { className: "flex flex-col gap-2", children: [_jsxs(View, { className: "flex flex-row items-center gap-2", children: [_jsx(Text, { className: "block text-sm font-bold text-slate-100", children: strategyName }), _jsx(Badge, { className: "bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-30", children: "\u81EA\u5B9A\u4E49" })] }), _jsxs(Text, { className: "block text-xs text-slate-400", children: ["\u6807\u7684: ", stockInfo === null || stockInfo === void 0 ? void 0 : stockInfo.name, "(", selectedStock, ") | \u6307\u6807:", ' ', selectedIndicators.join(', ')] }), _jsxs(Text, { className: "block text-xs text-slate-400", children: ["\u4E70\u5165\u6761\u4EF6: ", buyConditions.length, " \u4E2A | \u5356\u51FA\u6761\u4EF6: ", sellConditions.length, " \u4E2A"] }), _jsxs(Text, { className: "block text-xs text-slate-400", children: ["\u98CE\u63A7: \u4ED3\u4F4D", positionSize, "% / \u6B62\u635F", stopLoss, "% / \u6B62\u76C8", takeProfit, "%"] }), _jsxs(View, { className: "flex flex-row gap-2 mt-1", children: [monitorEnabled && (_jsx(Badge, { className: "bg-purple-500 bg-opacity-20 text-purple-400 border-purple-500 border-opacity-30", children: "\u76D1\u542C\u4E2D" })), autoTrade && (_jsx(Badge, { className: "bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30", children: "\u81EA\u52A8\u4EA4\u6613" }))] })] })] }) })), _jsxs(Button, { className: "w-full bg-emerald-500 text-white h-12", onClick: handleSave, disabled: saving, children: [_jsx(Save, { size: 18, color: "#ffffff" }), _jsx(Text, { className: "text-base font-bold ml-2", children: saving ? '保存中...' : editId ? '更新策略' : '创建策略' })] })] }) }));
};
export default StrategyCreatePage;
//# sourceMappingURL=create.js.map