import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { View, Text, ScrollView } from '@tarojs/components';
import { useState, useEffect, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, TrendingUp, TrendingDown, Star, Plus } from 'lucide-react-taro';
const MarketPage = () => {
    const [tab, setTab] = useState('favorites');
    const [searchText, setSearchText] = useState('');
    const [marketList, setMarketList] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchLoading, setSearchLoading] = useState(false);
    const [favoriteSymbols, setFavoriteSymbols] = useState(new Set());
    useEffect(() => {
        loadMarket();
    }, []);
    const loadMarket = async () => {
        var _a, _b;
        try {
            setLoading(true);
            // 并行加载市场列表和自选列表
            const [marketRes, watchRes] = await Promise.all([
                Network.request({ url: '/api/market/list' }),
                Network.request({ url: '/api/stock/watchlist' }),
            ]);
            console.log('market:', marketRes.data);
            const marketData = ((_a = marketRes.data) === null || _a === void 0 ? void 0 : _a.data) || [];
            const watchData = ((_b = watchRes.data) === null || _b === void 0 ? void 0 : _b.data) || [];
            const favSet = new Set(watchData.filter((w) => w.enabled).map((w) => w.symbol));
            setFavoriteSymbols(favSet);
            setMarketList(marketData.map((item) => (Object.assign(Object.assign({}, item), { changePercent: item.changePercent || 0, price: item.price || 0, volume24h: item.volume24h || item.volume || 0, isFavorite: favSet.has(item.symbol) }))));
        }
        catch (e) {
            console.error('loadMarket error:', e);
        }
        finally {
            setLoading(false);
        }
    };
    const handleSearch = useCallback(async (query) => {
        var _a;
        const q = query.trim();
        if (!q) {
            setSearchResults([]);
            return;
        }
        try {
            setSearchLoading(true);
            const res = await Network.request({ url: '/api/stock/search', data: { q } });
            console.log('search results:', res.data);
            const data = ((_a = res.data) === null || _a === void 0 ? void 0 : _a.data) || [];
            setSearchResults(data.map((item) => ({
                symbol: item.symbol,
                name: item.name,
                price: item.price || 0,
                changePercent: item.changePercent || 0,
                volume24h: item.volume || 0,
                isFavorite: favoriteSymbols.has(item.symbol),
                isCustom: item.isCustom,
                industry: item.industry,
            })));
        }
        catch (e) {
            console.error('search error:', e);
        }
        finally {
            setSearchLoading(false);
        }
    }, [favoriteSymbols]);
    const toggleFavorite = async (symbol, name) => {
        try {
            const isFav = favoriteSymbols.has(symbol);
            if (isFav) {
                await Network.request({
                    url: `/api/stock/watchlist/${symbol}`,
                    method: 'DELETE',
                });
            }
            else {
                await Network.request({
                    url: '/api/stock/watchlist',
                    method: 'POST',
                    data: { symbol, name, enabled: true },
                });
            }
            Taro.showToast({
                title: isFav ? '已移除自选' : '已添加自选',
                icon: 'success',
            });
            // 更新本地状态
            const newFavs = new Set(favoriteSymbols);
            if (isFav) {
                newFavs.delete(symbol);
            }
            else {
                newFavs.add(symbol);
            }
            setFavoriteSymbols(newFavs);
            // 更新列表状态
            setMarketList(prev => prev.map(item => item.symbol === symbol ? Object.assign(Object.assign({}, item), { isFavorite: !isFav }) : item));
            setSearchResults(prev => prev.map(item => item.symbol === symbol ? Object.assign(Object.assign({}, item), { isFavorite: !isFav }) : item));
        }
        catch (e) {
            console.error('toggleFavorite error:', e);
            Taro.showToast({ title: '操作失败', icon: 'error' });
        }
    };
    const displayList = searchText.trim()
        ? searchResults
        : (() => {
            let list = marketList.filter((item) => {
                if (tab === 'favorites')
                    return item.isFavorite;
                if (tab === 'gainers')
                    return item.changePercent > 0;
                if (tab === 'losers')
                    return item.changePercent < 0;
                return true;
            });
            if (tab === 'gainers')
                list = list.sort((a, b) => b.changePercent - a.changePercent);
            if (tab === 'losers')
                list = list.sort((a, b) => a.changePercent - b.changePercent);
            return list;
        })();
    return (_jsxs(View, { className: "flex flex-col h-full bg-slate-900", children: [_jsxs(View, { className: "px-4 pt-3 pb-2", children: [_jsxs(View, { className: "flex flex-row items-center gap-2 bg-slate-800 rounded-lg px-3 py-2", children: [_jsx(Search, { size: 16, color: "#64748b" }), _jsx(Input, { className: "flex-1 bg-transparent text-sm text-slate-100 border-none", placeholder: "\u641C\u7D22\u80A1\u7968\u4EE3\u7801\u6216\u540D\u79F0...", placeholderStyle: "color: #64748b", value: searchText, onInput: (e) => {
                                    const val = e.detail.value;
                                    setSearchText(val);
                                    handleSearch(val);
                                } })] }), searchText.trim() && (_jsxs(Text, { className: "block text-xs text-slate-500 mt-1 pl-1", children: ["\u641C\u7D22\u5230 ", searchResults.length, " \u53EA\u80A1\u7968\uFF0C\u70B9\u51FB\u661F\u6807\u52A0\u81EA\u9009"] }))] }), !searchText.trim() && (_jsx(Tabs, { value: tab, onValueChange: setTab, className: "flex-1", children: _jsx(View, { className: "px-4", children: _jsxs(TabsList, { className: "bg-slate-800", children: [_jsx(TabsTrigger, { value: "favorites", children: "\u81EA\u9009" }), _jsx(TabsTrigger, { value: "all", children: "\u5168\u90E8" }), _jsx(TabsTrigger, { value: "gainers", children: "\u6DA8\u5E45\u699C" }), _jsx(TabsTrigger, { value: "losers", children: "\u8DCC\u5E45\u699C" })] }) }) })), _jsx(ScrollView, { scrollY: true, className: "flex-1 smooth-scroll hide-scrollbar", children: _jsxs(View, { className: "px-4 pb-20", children: [_jsxs(View, { className: "flex flex-row items-center justify-between py-2 border-b border-slate-700", children: [_jsx(Text, { className: "block text-xs text-slate-500 flex-1", children: "\u80A1\u7968" }), _jsx(Text, { className: "block text-xs text-slate-500 text-right w-20", children: "\u6700\u65B0\u4EF7" }), _jsx(Text, { className: "block text-xs text-slate-500 text-right w-20", children: "\u6DA8\u8DCC\u5E45" }), _jsx(Text, { className: "block text-xs text-slate-500 text-right w-10", children: "\u81EA\u9009" })] }), loading || searchLoading ? (_jsx(View, { className: "flex items-center justify-center py-12", children: _jsx(Text, { className: "block text-sm text-slate-500", children: "\u52A0\u8F7D\u4E2D..." }) })) : displayList.length === 0 ? (_jsx(View, { className: "flex items-center justify-center py-12", children: _jsx(Text, { className: "block text-sm text-slate-500", children: searchText.trim() ? '未找到相关股票' : '暂无数据' }) })) : (displayList.map((item) => (_jsx(Card, { className: "bg-transparent border-none mt-0", children: _jsx(CardContent, { className: "p-0", children: _jsxs(View, { className: "flex flex-row items-center justify-between py-3 border-b border-slate-800", children: [_jsx(View, { className: "flex flex-row items-center gap-2 flex-1 min-w-0", children: _jsxs(View, { className: "flex flex-col gap-0.5", children: [_jsxs(View, { className: "flex flex-row items-center gap-1", children: [_jsx(Text, { className: "block text-sm font-medium text-slate-100", children: item.symbol }), item.isCustom && (_jsx(Badge, { className: "bg-blue-500 bg-opacity-20 text-blue-400 border-none text-[10px] px-1 py-0", children: "\u81EA\u5B9A\u4E49" })), item.changePercent > 0 ? (_jsx(TrendingUp, { size: 10, color: "#22c55e" })) : item.changePercent < 0 ? (_jsx(TrendingDown, { size: 10, color: "#ef4444" })) : null] }), _jsx(Text, { className: "block text-xs text-slate-500 truncate max-w-32", children: item.name })] }) }), _jsx(Text, { className: "block text-sm font-medium text-slate-100 text-right w-20 tabular-nums", children: item.price > 0 ? item.price.toFixed(2) : '--' }), _jsx(View, { className: "w-20 flex justify-end", children: item.price > 0 ? (_jsxs(Badge, { className: `text-xs tabular-nums ${item.changePercent > 0
                                                    ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30'
                                                    : item.changePercent < 0
                                                        ? 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30'
                                                        : 'bg-slate-700 text-slate-400 border-slate-600'}`, children: [item.changePercent >= 0 ? '+' : '', item.changePercent.toFixed(2), "%"] })) : (_jsx(Text, { className: "block text-xs text-slate-600", children: "--" })) }), _jsx(View, { className: "w-10 flex justify-center items-center", onClick: () => toggleFavorite(item.symbol, item.name), children: item.isFavorite ? (_jsx(Star, { size: 18, color: "#f59e0b", filled: true })) : (_jsx(View, { className: "w-7 h-7 flex items-center justify-center rounded-full bg-slate-800", children: _jsx(Plus, { size: 14, color: "#94a3b8" }) })) })] }) }) }, item.symbol))))] }) })] }));
};
export default MarketPage;
//# sourceMappingURL=index.js.map