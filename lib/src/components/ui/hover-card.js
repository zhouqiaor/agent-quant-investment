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
import { cn } from "@/lib/utils";
import { isH5 } from "@/lib/platform";
import { getRectById, getViewport } from "@/lib/measure";
import { Portal } from "@/components/ui/portal";
const HoverCardContext = React.createContext(null);
const HoverCard = ({ open: openProp, defaultOpen = false, onOpenChange, children, }) => {
    const baseIdRef = React.useRef(`hover-card-${Math.random().toString(36).slice(2, 10)}`);
    const [openState, setOpenState] = React.useState(defaultOpen);
    const open = openProp !== undefined ? openProp : openState;
    const hoverRef = React.useRef({ trigger: false, content: false });
    const closeTimerRef = React.useRef(null);
    const handleOpenChange = (newOpen) => {
        if (openProp === undefined) {
            setOpenState(newOpen);
        }
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(newOpen);
    };
    const setHoverPart = React.useCallback((part, hovering) => {
        if (!isH5())
            return;
        hoverRef.current[part] = hovering;
        if (hovering) {
            if (closeTimerRef.current)
                clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
            handleOpenChange(true);
            return;
        }
        if (closeTimerRef.current)
            clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
            if (!hoverRef.current.trigger && !hoverRef.current.content) {
                handleOpenChange(false);
            }
        }, 80);
    }, [handleOpenChange]);
    React.useEffect(() => {
        return () => {
            if (closeTimerRef.current)
                clearTimeout(closeTimerRef.current);
        };
    }, []);
    return (_jsx(HoverCardContext.Provider, { value: {
            open,
            onOpenChange: handleOpenChange,
            triggerId: baseIdRef.current,
            setHoverPart,
        }, children: children }));
};
const HoverCardTrigger = React.forwardRef((_a, ref) => {
    var { className, children, onClick, onMouseEnter, onMouseLeave } = _a, props = __rest(_a, ["className", "children", "onClick", "onMouseEnter", "onMouseLeave"]);
    const context = React.useContext(HoverCardContext);
    return (_jsx(View, Object.assign({}, props, { ref: ref, id: context === null || context === void 0 ? void 0 : context.triggerId, className: className, onClick: (e) => {
            var _a;
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
            e.stopPropagation();
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, !context.open);
        } }, (isH5()
        ? {
            onMouseEnter: (e) => {
                var _a;
                onMouseEnter === null || onMouseEnter === void 0 ? void 0 : onMouseEnter(e);
                (_a = context === null || context === void 0 ? void 0 : context.setHoverPart) === null || _a === void 0 ? void 0 : _a.call(context, "trigger", true);
            },
            onMouseLeave: (e) => {
                var _a;
                onMouseLeave === null || onMouseLeave === void 0 ? void 0 : onMouseLeave(e);
                (_a = context === null || context === void 0 ? void 0 : context.setHoverPart) === null || _a === void 0 ? void 0 : _a.call(context, "trigger", false);
            },
        }
        : {}), { children: children })));
});
HoverCardTrigger.displayName = "HoverCardTrigger";
const HoverCardContent = React.forwardRef((_a, ref) => {
    var { className, align = "center", side = "bottom", sideOffset = 4, onMouseEnter, onMouseLeave } = _a, props = __rest(_a, ["className", "align", "side", "sideOffset", "onMouseEnter", "onMouseLeave"]);
    const context = React.useContext(HoverCardContext);
    const contentId = React.useRef(`hover-card-content-${Math.random().toString(36).slice(2, 10)}`);
    const [position, setPosition] = React.useState(null);
    React.useEffect(() => {
        if (!(context === null || context === void 0 ? void 0 : context.open)) {
            setPosition(null);
            return;
        }
        let cancelled = false;
        const compute = async () => {
            const [triggerRect, contentRect] = await Promise.all([
                getRectById(context.triggerId),
                getRectById(contentId.current),
            ]);
            if (cancelled)
                return;
            if (!(triggerRect === null || triggerRect === void 0 ? void 0 : triggerRect.width) || !(contentRect === null || contentRect === void 0 ? void 0 : contentRect.width))
                return;
            const vw = getViewport().width;
            const vh = getViewport().height;
            const margin = 8;
            const crossStart = (side === "left" || side === "right")
                ? triggerRect.top
                : triggerRect.left;
            const crossSize = (side === "left" || side === "right")
                ? triggerRect.height
                : triggerRect.width;
            const contentCrossSize = (side === "left" || side === "right")
                ? contentRect.height
                : contentRect.width;
            const cross = (() => {
                if (align === "start")
                    return crossStart;
                if (align === "end")
                    return crossStart + crossSize - contentCrossSize;
                return crossStart + crossSize / 2 - contentCrossSize / 2;
            })();
            let left = 0;
            let top = 0;
            if (side === "bottom" || side === "top") {
                left = cross;
                top =
                    side === "bottom"
                        ? triggerRect.top + triggerRect.height + sideOffset
                        : triggerRect.top - contentRect.height - sideOffset;
            }
            else {
                top = cross;
                left =
                    side === "right"
                        ? triggerRect.left + triggerRect.width + sideOffset
                        : triggerRect.left - contentRect.width - sideOffset;
            }
            left = Math.min(Math.max(left, margin), vw - contentRect.width - margin);
            top = Math.min(Math.max(top, margin), vh - contentRect.height - margin);
            setPosition({ left, top });
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
    }, [align, context === null || context === void 0 ? void 0 : context.open, context === null || context === void 0 ? void 0 : context.triggerId, side, sideOffset]);
    if (!(context === null || context === void 0 ? void 0 : context.open))
        return null;
    const baseClassName = "fixed z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95";
    const contentStyle = position
        ? { left: position.left, top: position.top }
        : {
            left: 0,
            top: 0,
            opacity: 0,
            pointerEvents: "none",
        };
    const overlay = !isH5() ? (_jsx(View, { className: "fixed inset-0 z-50 bg-transparent", onClick: () => { var _a; return (_a = context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false); } })) : null;
    return (_jsxs(Portal, { children: [overlay, _jsx(View, Object.assign({}, props, { ref: ref, id: contentId.current, className: cn(baseClassName, className), style: contentStyle }, (isH5()
                ? {
                    onMouseEnter: (e) => {
                        var _a;
                        onMouseEnter === null || onMouseEnter === void 0 ? void 0 : onMouseEnter(e);
                        (_a = context === null || context === void 0 ? void 0 : context.setHoverPart) === null || _a === void 0 ? void 0 : _a.call(context, "content", true);
                    },
                    onMouseLeave: (e) => {
                        var _a;
                        onMouseLeave === null || onMouseLeave === void 0 ? void 0 : onMouseLeave(e);
                        (_a = context === null || context === void 0 ? void 0 : context.setHoverPart) === null || _a === void 0 ? void 0 : _a.call(context, "content", false);
                    },
                }
                : {})))] }));
});
HoverCardContent.displayName = "HoverCardContent";
export { HoverCard, HoverCardTrigger, HoverCardContent };
//# sourceMappingURL=hover-card.js.map