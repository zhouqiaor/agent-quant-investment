var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal";
import { useKeyboardOffset } from "@/lib/hooks/use-keyboard-offset";
import { isH5 } from "@/lib/platform";
const PopoverContext = React.createContext(null);
const Popover = ({ open: openProp, defaultOpen, onOpenChange, children }) => {
    const baseIdRef = React.useRef(`popover-${Math.random().toString(36).slice(2, 10)}`);
    const [openState, setOpenState] = React.useState(defaultOpen || false);
    const open = openProp !== undefined ? openProp : openState;
    const handleOpenChange = (newOpen) => {
        if (openProp === undefined) {
            setOpenState(newOpen);
        }
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(newOpen);
    };
    React.useEffect(() => {
        if (!isH5())
            return;
        if (!open)
            return;
        const onKeyDown = (e) => {
            if (e.key !== "Escape")
                return;
            e.stopPropagation();
            handleOpenChange(false);
        };
        window.addEventListener("keydown", onKeyDown, true);
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
        };
    }, [open]);
    return (_jsx(PopoverContext.Provider, { value: { open, onOpenChange: handleOpenChange, triggerId: baseIdRef.current }, children: children }));
};
const PopoverTrigger = React.forwardRef((_a, ref) => {
    var { className, children, asChild } = _a, props = __rest(_a, ["className", "children", "asChild"]);
    const context = React.useContext(PopoverContext);
    return (_jsx(View, Object.assign({ ref: ref, id: context === null || context === void 0 ? void 0 : context.triggerId, className: cn("w-fit", className), onClick: (e) => {
            var _a;
            e.stopPropagation();
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, !context.open);
        } }, props, { children: children })));
});
PopoverTrigger.displayName = "PopoverTrigger";
const PopoverContent = React.forwardRef((_a, ref) => {
    var _b;
    var { className, align = "center", side, position: positionProp, sideOffset = 4, style } = _a, props = __rest(_a, ["className", "align", "side", "position", "sideOffset", "style"]);
    const context = React.useContext(PopoverContext);
    const offset = useKeyboardOffset();
    const resolvedSide = (_b = positionProp !== null && positionProp !== void 0 ? positionProp : side) !== null && _b !== void 0 ? _b : "bottom";
    const contentId = React.useRef(`popover-content-${Math.random().toString(36).slice(2, 10)}`);
    const [contentPosition, setContentPosition] = React.useState(null);
    React.useEffect(() => {
        if (!(context === null || context === void 0 ? void 0 : context.open)) {
            setContentPosition(null);
            return;
        }
        let cancelled = false;
        const getViewport = () => {
            if (isH5() && typeof window !== "undefined") {
                return { width: window.innerWidth, height: window.innerHeight };
            }
            try {
                const info = Taro.getSystemInfoSync();
                return { width: info.windowWidth, height: info.windowHeight };
            }
            catch (_a) {
                return { width: 375, height: 667 };
            }
        };
        const getRectH5 = (id) => {
            if (!isH5() || typeof document === "undefined")
                return null;
            const el = document.getElementById(id);
            if (!el)
                return null;
            const r = el.getBoundingClientRect();
            return { left: r.left, top: r.top, width: r.width, height: r.height };
        };
        const getRect = (id) => {
            const h5Rect = getRectH5(id);
            if (h5Rect)
                return Promise.resolve(h5Rect);
            return new Promise((resolve) => {
                const query = Taro.createSelectorQuery();
                query
                    .select(`#${id}`)
                    .boundingClientRect((res) => {
                    const rect = Array.isArray(res) ? res[0] : res;
                    resolve(rect || null);
                })
                    .exec();
            });
        };
        const compute = async () => {
            const [triggerRect, contentRect] = await Promise.all([
                getRect(context.triggerId),
                getRect(contentId.current),
            ]);
            if (cancelled)
                return;
            if (!(triggerRect === null || triggerRect === void 0 ? void 0 : triggerRect.width) || !(contentRect === null || contentRect === void 0 ? void 0 : contentRect.width))
                return;
            const viewport = getViewport();
            const vw = viewport.width;
            const vh = Math.max(0, viewport.height - (isH5() ? 0 : offset || 0));
            const margin = 8;
            const crossStart = resolvedSide === "left" || resolvedSide === "right" ? triggerRect.top : triggerRect.left;
            const crossSize = resolvedSide === "left" || resolvedSide === "right" ? triggerRect.height : triggerRect.width;
            const contentCrossSize = resolvedSide === "left" || resolvedSide === "right" ? contentRect.height : contentRect.width;
            const cross = (() => {
                if (align === "start")
                    return crossStart;
                if (align === "end")
                    return crossStart + crossSize - contentCrossSize;
                return crossStart + crossSize / 2 - contentCrossSize / 2;
            })();
            let left = 0;
            let top = 0;
            if (resolvedSide === "bottom" || resolvedSide === "top") {
                left = cross;
                top =
                    resolvedSide === "bottom"
                        ? triggerRect.top + triggerRect.height + sideOffset
                        : triggerRect.top - contentRect.height - sideOffset;
            }
            else {
                top = cross;
                left =
                    resolvedSide === "right"
                        ? triggerRect.left + triggerRect.width + sideOffset
                        : triggerRect.left - contentRect.width - sideOffset;
            }
            left = Math.min(Math.max(left, margin), vw - contentRect.width - margin);
            top = Math.min(Math.max(top, margin), vh - contentRect.height - margin);
            setContentPosition({ left, top });
        };
        const raf = (() => {
            if (typeof requestAnimationFrame !== "undefined") {
                return requestAnimationFrame(() => compute());
            }
            return setTimeout(() => compute(), 0);
        })();
        return () => {
            cancelled = true;
            if (typeof cancelAnimationFrame !== "undefined") {
                cancelAnimationFrame(raf);
            }
            else {
                clearTimeout(raf);
            }
        };
    }, [align, context === null || context === void 0 ? void 0 : context.open, context === null || context === void 0 ? void 0 : context.triggerId, offset, resolvedSide, sideOffset]);
    if (!(context === null || context === void 0 ? void 0 : context.open))
        return null;
    const baseClassName = "fixed z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95";
    const contentStyle = contentPosition
        ? Object.assign(Object.assign({}, style), { left: contentPosition.left, top: contentPosition.top })
        : Object.assign(Object.assign({}, style), { left: 0, top: 0, opacity: 0, pointerEvents: "none" });
    return (_jsxs(Portal, { children: [_jsx(View, { className: "fixed inset-0 z-50 bg-transparent", onClick: () => { var _a; return (_a = context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false); } }), _jsx(View, Object.assign({ ref: ref, className: cn(baseClassName, className), id: contentId.current, style: contentStyle }, props))] }));
});
PopoverContent.displayName = "PopoverContent";
const PopoverHeader = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("grid gap-1.5", className) }, props)));
});
PopoverHeader.displayName = "PopoverHeader";
const PopoverTitle = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("font-medium leading-none", className) }, props)));
});
PopoverTitle.displayName = "PopoverTitle";
const PopoverDescription = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("text-sm text-muted-foreground", className) }, props)));
});
PopoverDescription.displayName = "PopoverDescription";
export { Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription, };
//# sourceMappingURL=popover.js.map