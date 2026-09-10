import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { View } from '@tarojs/components';
import { Component, useSyncExternalStore } from 'react';
import { CircleAlert, Copy, RefreshCw, X } from 'lucide-react-taro';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Portal } from '@/components/ui/portal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { IS_H5_ENV } from './env';
const EMPTY_STORE = {
    error: null,
    report: '',
    source: '',
    visible: false,
    open: false,
    timestamp: '',
};
const ERROR_ACCENT_COLOR = 'hsl(360, 100%, 45%)';
let handlersInstalled = false;
let overlayStore = EMPTY_STORE;
const listeners = new Set();
const emitChange = () => {
    listeners.forEach(listener => listener());
};
const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
const getSnapshot = () => overlayStore;
const setOverlayStore = (nextStore) => {
    overlayStore = nextStore;
    emitChange();
};
const copyText = async (text) => {
    var _a;
    if (typeof window === 'undefined')
        return false;
    try {
        if ((_a = navigator.clipboard) === null || _a === void 0 ? void 0 : _a.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    }
    catch (error) {
        console.warn('[H5ErrorBoundary] Clipboard API copy failed:', error);
    }
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        return copied;
    }
    catch (error) {
        console.warn('[H5ErrorBoundary] Fallback copy failed:', error);
        return false;
    }
};
const normalizeError = (value) => {
    if (value instanceof Error) {
        return value;
    }
    if (typeof value === 'string') {
        return new Error(value);
    }
    try {
        return new Error(JSON.stringify(value));
    }
    catch (_a) {
        return new Error(String(value));
    }
};
const buildErrorReport = (error, options = {}) => {
    const lines = [
        '[H5 Runtime Error]',
        `Time: ${new Date().toISOString()}`,
        options.source ? `Source: ${options.source}` : '',
        `Name: ${error.name}`,
        `Message: ${error.message}`,
        error.stack ? `Stack:\n${error.stack}` : '',
        options.componentStack ? `Component Stack:\n${options.componentStack}` : '',
        typeof navigator !== 'undefined'
            ? `User Agent: ${navigator.userAgent}`
            : '',
    ].filter(Boolean);
    return lines.join('\n\n');
};
const setPanelOpen = (open) => {
    if (!overlayStore.visible)
        return;
    setOverlayStore(Object.assign(Object.assign({}, overlayStore), { open }));
};
export const showH5ErrorOverlay = (input, options = {}) => {
    if (typeof window === 'undefined') {
        return;
    }
    const error = normalizeError(input);
    const report = buildErrorReport(error, options);
    const timestamp = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    setOverlayStore({
        error,
        report,
        source: options.source || 'runtime',
        timestamp,
        visible: true,
        open: false,
    });
    console.error('[H5ErrorOverlay] Showing error overlay:', error, options);
};
const handleWindowError = (event) => {
    const error = event.error || new Error(event.message || 'Unknown H5 runtime error');
    showH5ErrorOverlay(error, { source: 'window.error' });
};
const handleUnhandledRejection = (event) => {
    showH5ErrorOverlay(event.reason, { source: 'window.unhandledrejection' });
};
export const initializeH5ErrorHandling = () => {
    if (!IS_H5_ENV || typeof window === 'undefined' || handlersInstalled) {
        return;
    }
    handlersInstalled = true;
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
};
const H5ErrorOverlayHost = () => {
    var _a, _b;
    const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    if (!IS_H5_ENV || !store.visible) {
        return null;
    }
    const errorName = ((_a = store.error) === null || _a === void 0 ? void 0 : _a.name) || 'Error';
    return (_jsx(Portal, { children: _jsxs(View, { className: "pointer-events-none fixed inset-0 z-[2147483646]", children: [_jsx(View, { className: "pointer-events-auto fixed bottom-5 left-5", children: _jsx(Button, { variant: "outline", size: "icon", className: cn('h-11 w-11 rounded-full shadow-md transition-transform'), style: {
                            backgroundColor: 'hsl(359, 100%, 97%)',
                            borderColor: 'hsl(359, 100%, 94%)',
                            color: ERROR_ACCENT_COLOR,
                        }, onClick: () => setPanelOpen(!store.open), children: _jsx(CircleAlert, { size: 22, color: ERROR_ACCENT_COLOR }) }) }), store.open && (_jsx(View, { className: "pointer-events-none fixed inset-0 bg-white bg-opacity-15 supports-[backdrop-filter]:backdrop-blur-md", children: _jsx(View, { className: "absolute inset-0 flex items-center justify-center px-4 py-4", children: _jsx(View, { className: "w-full max-w-md", style: {
                                width: 'min(calc(100vw - 32px), var(--h5-phone-width, 390px))',
                                height: 'min(calc(100vh - 32px), 900px)',
                            }, children: _jsx(Card, { className: cn('pointer-events-auto h-full rounded-2xl border border-border bg-background text-foreground shadow-2xl'), children: _jsxs(View, { className: "relative flex h-full flex-col", children: [_jsxs(CardHeader, { className: "gap-2 p-4 pb-2", children: [_jsxs(View, { className: "flex items-start justify-between gap-3", children: [_jsxs(View, { className: "flex flex-wrap items-center gap-2", children: [_jsx(Badge, { variant: "destructive", className: "border-none bg-red-500 px-3 py-1 text-xs font-medium text-white", children: "Runtime Error" }), _jsx(Badge, { variant: "outline", className: "px-3 py-1 text-xs", children: store.source })] }), _jsxs(View, { className: "flex shrink-0 items-center gap-1", children: [_jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 rounded-full", onClick: () => window.location.reload(), children: _jsx(RefreshCw, { size: 15, color: "inherit" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 rounded-full", onClick: () => setPanelOpen(false), children: _jsx(X, { size: 17, color: "inherit" }) })] })] }), _jsxs(View, { className: "flex items-center justify-between gap-3", children: [_jsx(CardTitle, { className: "text-left text-lg", children: errorName }), _jsxs(Button, { variant: "outline", size: "sm", className: "shrink-0 rounded-lg", onClick: async () => {
                                                                const copied = await copyText(store.report);
                                                                if (copied) {
                                                                    toast.success('已复制错误信息', {
                                                                        description: '可发送给 Agent 进行自动修复',
                                                                        position: 'top-center',
                                                                    });
                                                                    return;
                                                                }
                                                                toast.warning('复制失败', {
                                                                    description: '请直接选中文本后手动复制。',
                                                                    position: 'top-center',
                                                                });
                                                            }, children: [_jsx(Copy, { size: 15, color: "inherit" }), _jsx(View, { children: "\u590D\u5236\u9519\u8BEF" })] })] })] }), _jsx(CardContent, { className: "min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-2", children: _jsxs(View, { className: "flex h-full min-h-0 flex-col gap-2", children: [_jsxs(View, { className: "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border px-3 py-2 text-sm", children: [_jsxs(View, { className: "flex items-center gap-2", children: [_jsx(View, { className: "text-muted-foreground", children: "Error" }), _jsx(View, { className: "font-medium text-foreground", children: ((_b = store.error) === null || _b === void 0 ? void 0 : _b.name) || 'Error' })] }), _jsx(View, { className: "h-4 w-px bg-border" }), _jsxs(View, { className: "flex items-center gap-2", children: [_jsx(View, { className: "text-muted-foreground", children: "Source" }), _jsx(View, { className: "font-medium text-foreground", children: store.source })] })] }), _jsxs(View, { className: "min-h-0 flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-black text-white", children: [_jsxs(View, { className: "flex items-center justify-between border-b border-white border-opacity-10 px-3 py-3", children: [_jsx(View, { className: "text-xs font-medium uppercase tracking-wide text-zinc-400", children: "Full Report" }), _jsx(Badge, { variant: "outline", className: "border-zinc-700 bg-transparent px-2 py-1 text-xs text-zinc-400", children: store.timestamp })] }), _jsx(ScrollArea, { className: "min-h-0 flex-1 w-full", orientation: "both", children: _jsx(View, { className: "inline-block min-w-full whitespace-pre px-3 py-3 pb-8 font-mono text-xs leading-6 text-zinc-200", children: store.report }) })] })] }) })] }) }) }) }) }))] }) }));
};
class H5ErrorBoundaryInner extends Component {
    constructor() {
        super(...arguments);
        this.state = {
            error: null,
        };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidUpdate(prevProps) {
        if (this.state.error && prevProps.children !== this.props.children) {
            this.setState({ error: null });
        }
    }
    componentDidCatch(error, info) {
        showH5ErrorOverlay(error, {
            source: 'React Error Boundary',
            componentStack: info.componentStack || '',
        });
    }
    render() {
        return (_jsxs(_Fragment, { children: [_jsx(H5ErrorOverlayHost, {}), this.state.error ? null : this.props.children] }));
    }
}
export const H5ErrorBoundary = ({ children }) => {
    if (!IS_H5_ENV) {
        return _jsx(_Fragment, { children: children });
    }
    return _jsx(H5ErrorBoundaryInner, { children: children });
};
//# sourceMappingURL=h5-error-boundary.js.map