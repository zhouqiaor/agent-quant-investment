import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Check, Info, Loader, TriangleAlert, X, CircleAlert } from "lucide-react-taro";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal";
const listeners = [];
let toasts = [];
const notify = () => {
    listeners.forEach((l) => l([...toasts]));
};
const createToast = (title, data = {}) => {
    var _a;
    const id = data.id || Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const existingToast = toasts.find((t) => t.id === id);
    if (existingToast) {
        toasts = toasts.map((t) => t.id === id ? Object.assign(Object.assign(Object.assign({}, t), data), { title: title || t.title }) : t);
    }
    else {
        const newToast = Object.assign(Object.assign({}, data), { id,
            title, type: data.type || "default", dismissible: (_a = data.dismissible) !== null && _a !== void 0 ? _a : true });
        toasts = [...toasts, newToast];
    }
    notify();
    return id;
};
const dismiss = (id) => {
    if (!id) {
        toasts = [];
    }
    else {
        toasts = toasts.filter((t) => t.id !== id);
    }
    notify();
};
const toastFn = (title, data) => createToast(title, data);
const toast = Object.assign(toastFn, {
    success: (title, data) => createToast(title, Object.assign(Object.assign({}, data), { type: "success" })),
    error: (title, data) => createToast(title, Object.assign(Object.assign({}, data), { type: "error" })),
    warning: (title, data) => createToast(title, Object.assign(Object.assign({}, data), { type: "warning" })),
    info: (title, data) => createToast(title, Object.assign(Object.assign({}, data), { type: "info" })),
    loading: (title, data) => createToast(title, Object.assign(Object.assign({}, data), { type: "loading" })),
    message: (title, data) => createToast(title, Object.assign(Object.assign({}, data), { type: "default" })),
    custom: (jsx, data) => {
        const id = (data === null || data === void 0 ? void 0 : data.id) || Date.now().toString();
        return createToast(null, Object.assign(Object.assign({}, data), { id, jsx }));
    },
    dismiss,
    promise: (promise, data) => {
        const id = toast.loading(data.loading, Object.assign({}, data));
        const p = typeof promise === "function" ? promise() : promise;
        p.then((res) => {
            const successMessage = typeof data.success === "function" ? data.success(res) : data.success;
            toast.success(successMessage, Object.assign({ id }, data));
        })
            .catch((err) => {
            const errorMessage = typeof data.error === "function" ? data.error(err) : data.error;
            toast.error(errorMessage, Object.assign({ id }, data));
        })
            .finally(() => {
            var _a;
            (_a = data.finally) === null || _a === void 0 ? void 0 : _a.call(data);
        });
        return id;
    }
});
const Toaster = ({ position = "bottom-right", richColors = false, expand = false, closeButton = false, visibleToasts = 3, duration = 4000, gap = 14, className, style, toastOptions }) => {
    const [activeToasts, setActiveToasts] = React.useState([]);
    const [closingIds, setClosingIds] = React.useState(() => new Set());
    const [frontHeight, setFrontHeight] = React.useState(null);
    const frontIdRef = React.useRef(`toaster-front-${Math.random().toString(36).slice(2, 9)}`);
    React.useEffect(() => {
        listeners.push(setActiveToasts);
        return () => {
            const index = listeners.indexOf(setActiveToasts);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }, []);
    const getPositionStyle = (pos) => {
        switch (pos) {
            case "top-left": return "top-0 left-0 right-0 justify-start";
            case "top-right": return "top-0 left-0 right-0 justify-end";
            case "bottom-left": return "bottom-0 left-0 right-0 justify-start";
            case "bottom-right": return "bottom-0 left-0 right-0 justify-end";
            case "top-center": return "top-0 left-0 right-0 justify-center";
            case "bottom-center": return "bottom-0 left-0 right-0 justify-center";
            default: return "bottom-0 left-0 right-0 justify-end";
        }
    };
    const isTop = position.includes("top");
    React.useEffect(() => {
        if (expand)
            return;
        if (activeToasts.length <= visibleToasts)
            return;
        const overflow = activeToasts.slice(0, activeToasts.length - visibleToasts);
        const nextToClose = overflow.find((t) => !closingIds.has(t.id));
        if (!nextToClose)
            return;
        setClosingIds((prev) => {
            if (prev.has(nextToClose.id))
                return prev;
            const next = new Set(prev);
            next.add(nextToClose.id);
            return next;
        });
    }, [activeToasts, closingIds, expand, visibleToasts]);
    React.useEffect(() => {
        setClosingIds((prev) => {
            if (prev.size === 0)
                return prev;
            const activeIds = new Set(activeToasts.map((t) => t.id));
            const next = new Set();
            prev.forEach((id) => {
                if (activeIds.has(id))
                    next.add(id);
            });
            return next.size === prev.size ? prev : next;
        });
    }, [activeToasts]);
    const toastsToRender = React.useMemo(() => {
        if (expand)
            return activeToasts;
        const keep = activeToasts.slice(-visibleToasts);
        const overflowCount = Math.max(0, activeToasts.length - visibleToasts);
        const overflowIds = new Set(activeToasts.slice(0, overflowCount).map((t) => t.id));
        const closing = activeToasts.filter((t) => overflowIds.has(t.id) && closingIds.has(t.id));
        return [...closing, ...keep];
    }, [activeToasts, closingIds, expand, visibleToasts]);
    const listStyle = expand ? { gap } : undefined;
    React.useEffect(() => {
        if (toastsToRender.length === 0)
            return;
        const timer = setTimeout(() => {
            const query = Taro.createSelectorQuery();
            query
                .select(`#${frontIdRef.current}`)
                .boundingClientRect((res) => {
                const rect = Array.isArray(res) ? res[0] : res;
                if (rect === null || rect === void 0 ? void 0 : rect.height)
                    setFrontHeight(rect.height);
            })
                .exec();
        }, 50);
        return () => clearTimeout(timer);
    }, [toastsToRender.length]);
    return (_jsx(Portal, { children: _jsx(View, { className: cn("toaster fixed z-[2147483647] flex w-full pointer-events-none p-4", getPositionStyle(position), className), "data-position": position, style: style, children: _jsx(View, { className: cn("toaster-list relative w-full flex", isTop ? "flex-col-reverse" : "flex-col"), style: listStyle, children: toastsToRender.map((t, index) => {
                    var _a, _b;
                    const isFront = index === toastsToRender.length - 1;
                    const stackIndex = toastsToRender.length - 1 - index;
                    return (_jsx(ToastItem, { elementId: isFront ? frontIdRef.current : undefined, item: t, isExpanded: expand, isFront: isFront, stackIndex: stackIndex, isTop: isTop, gap: gap, forceClose: !expand && closingIds.has(t.id), frontHeight: frontHeight, duration: t.duration || duration, richColors: (_a = t.richColors) !== null && _a !== void 0 ? _a : richColors, closeButton: (_b = t.closeButton) !== null && _b !== void 0 ? _b : closeButton, toastOptions: toastOptions }, t.id));
                }) }) }) }));
};
const ToastItem = ({ elementId, item, isExpanded, isFront, stackIndex, isTop, gap, forceClose, frontHeight, duration, richColors, closeButton, toastOptions }) => {
    var _a;
    const [isVisible, setIsVisible] = React.useState(false);
    const [isRemoved, setIsRemoved] = React.useState(false);
    const timeOutRef = React.useRef();
    React.useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 16);
        if (item.duration === Infinity)
            return;
        const d = item.duration || duration;
        timeOutRef.current = setTimeout(() => {
            handleDismiss();
        }, d);
        return () => {
            clearTimeout(timer);
            clearTimeout(timeOutRef.current);
        };
    }, [item.duration, duration]);
    const handleDismiss = () => {
        setIsVisible(false);
        setTimeout(() => {
            var _a;
            setIsRemoved(true);
            (_a = item.onDismiss) === null || _a === void 0 ? void 0 : _a.call(item, item);
            dismiss(item.id);
        }, 400);
    };
    React.useEffect(() => {
        if (!forceClose)
            return;
        const t = setTimeout(() => handleDismiss(), 16);
        return () => clearTimeout(t);
    }, [forceClose]);
    const TypeIcon = {
        success: Check,
        error: CircleAlert,
        warning: TriangleAlert,
        info: Info,
        loading: Loader,
        default: null
    }[item.type || "default"];
    const palette = React.useMemo(() => {
        if (!richColors)
            return null;
        const type = item.type || "default";
        if (type === "success") {
            return { backgroundColor: "hsl(143, 85%, 96%)", borderColor: "hsl(145, 92%, 87%)", color: "hsl(140, 100%, 27%)" };
        }
        if (type === "info") {
            return { backgroundColor: "hsl(208, 100%, 97%)", borderColor: "hsl(221, 91%, 93%)", color: "hsl(210, 92%, 45%)" };
        }
        if (type === "warning") {
            return { backgroundColor: "hsl(49, 100%, 97%)", borderColor: "hsl(49, 91%, 84%)", color: "hsl(31, 92%, 45%)" };
        }
        if (type === "error") {
            return { backgroundColor: "hsl(359, 100%, 97%)", borderColor: "hsl(359, 100%, 94%)", color: "hsl(360, 100%, 45%)" };
        }
        return null;
    }, [item.type, richColors]);
    const iconColor = (_a = palette === null || palette === void 0 ? void 0 : palette.color) !== null && _a !== void 0 ? _a : "inherit";
    const isCollapsedStack = !isExpanded && !isFront;
    const lift = isTop ? 1 : -1;
    const enterOffset = (frontHeight !== null && frontHeight !== void 0 ? frontHeight : 80) * 1.5;
    const stackTranslate = lift * gap * stackIndex;
    const stackScale = 1 - stackIndex * 0.05;
    const transform = isCollapsedStack
        ? `translateY(${stackTranslate}px) scale(${stackScale})`
        : isVisible
            ? "translateY(0px)"
            : `translateY(${(-lift * enterOffset).toFixed(0)}px)`;
    const motionStyle = {
        transform,
        opacity: isVisible ? 1 : 0,
        transition: "transform 400ms ease, opacity 400ms ease, height 400ms ease, box-shadow 200ms ease",
        transformOrigin: isCollapsedStack ? (isTop ? "bottom" : "top") : "center"
    };
    if (isRemoved)
        return null;
    const isCustom = typeof item.jsx !== "undefined";
    const baseClasses = cn("toast pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 shadow-lg", !palette && "bg-background border-border text-foreground", item.className, toastOptions === null || toastOptions === void 0 ? void 0 : toastOptions.className);
    const finalStyle = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (palette || {})), item.style), motionStyle), { position: isCollapsedStack ? "absolute" : "relative" }), (isCollapsedStack ? (isTop ? { bottom: 0 } : { top: 0 }) : (isTop ? { top: 0 } : { bottom: 0 }))), { left: 0, right: 0, zIndex: isFront ? 50 : 40 - stackIndex, pointerEvents: isCollapsedStack ? "none" : "auto" }), (isCollapsedStack && frontHeight ? { height: frontHeight } : {}));
    if (isCustom) {
        const content = typeof item.jsx === "function" ? item.jsx(item.id) : item.jsx;
        return (_jsx(View, { className: cn("pointer-events-auto w-full"), id: elementId, style: finalStyle, children: _jsx(View, { style: { opacity: isCollapsedStack ? 0 : 1, transition: "opacity 400ms ease" }, children: content }) }));
    }
    return (_jsxs(View, { className: baseClasses, style: finalStyle, id: elementId, children: [_jsxs(View, { className: "flex gap-3 items-center flex-1", style: { opacity: isCollapsedStack ? 0 : 1, transition: "opacity 400ms ease" }, children: [TypeIcon && (_jsx(TypeIcon, { className: cn("shrink-0", item.type === "loading" && "animate-spin"), color: iconColor, size: 20 })), _jsxs(View, { className: "flex flex-col gap-1 flex-1", children: [item.title && _jsx(Text, { className: "text-sm font-semibold leading-none", style: palette ? { color: palette.color } : undefined, children: item.title }), item.description && (_jsx(Text, { className: cn("text-xs opacity-90 leading-normal", item.descriptionClassName), style: palette ? { color: palette.color } : undefined, children: item.description }))] })] }), (item.action || item.cancel) && (_jsxs(View, { className: "flex flex-nowrap items-center gap-2 shrink-0", style: { opacity: isCollapsedStack ? 0 : 1, transition: "opacity 400ms ease" }, children: [item.cancel && (_jsx(View, { className: "text-xs font-medium opacity-70 active:opacity-100 whitespace-nowrap", onClick: (e) => {
                            var _a;
                            e.stopPropagation();
                            (_a = item.cancel) === null || _a === void 0 ? void 0 : _a.onClick();
                            handleDismiss();
                        }, children: item.cancel.label })), item.action && (_jsx(View, { className: "text-xs font-medium active:opacity-80 px-3 py-2 rounded-md bg-primary text-primary-foreground shadow hover:bg-primary hover:bg-opacity-90 whitespace-nowrap", onClick: (e) => {
                            var _a;
                            e.stopPropagation();
                            (_a = item.action) === null || _a === void 0 ? void 0 : _a.onClick();
                            handleDismiss();
                        }, children: item.action.label }))] })), closeButton && (_jsx(View, { className: "absolute right-2 top-2 rounded-md p-1 opacity-50 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2", style: { opacity: isCollapsedStack ? 0 : undefined, transition: "opacity 400ms ease" }, onClick: (e) => {
                    e.stopPropagation();
                    handleDismiss();
                }, children: _jsx(X, { color: iconColor, size: 16 }) }))] }));
};
export { Toaster, toast };
//# sourceMappingURL=toast.js.map