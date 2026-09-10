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
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { View } from "@tarojs/components";
import { cn } from "@/lib/utils";
import { isH5 } from "@/lib/platform";
import { getRectById, getViewport } from "@/lib/measure";
import { Portal } from "@/components/ui/portal";
const TooltipContext = React.createContext(null);
const TooltipProvider = ({ children }) => _jsx(_Fragment, { children: children });
const Tooltip = ({ children, open: openProp, defaultOpen = false, onOpenChange, }) => {
    const baseIdRef = React.useRef(`tooltip-${Math.random().toString(36).slice(2, 10)}`);
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
    return (_jsx(TooltipContext.Provider, { value: {
            open,
            onOpenChange: handleOpenChange,
            triggerId: baseIdRef.current,
            setHoverPart,
        }, children: children }));
};
const TooltipTrigger = React.forwardRef((_a, ref) => {
    var { className, children, onClick, onMouseEnter, onMouseLeave } = _a, props = __rest(_a, ["className", "children", "onClick", "onMouseEnter", "onMouseLeave"]);
    const context = React.useContext(TooltipContext);
    return (_jsx(View, Object.assign({ ref: ref, id: context === null || context === void 0 ? void 0 : context.triggerId, className: cn("inline-flex w-fit justify-self-start", className), onClick: (e) => {
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
            e.stopPropagation();
            context === null || context === void 0 ? void 0 : context.onOpenChange(!context.open);
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
        : {}), props, { children: children })));
});
TooltipTrigger.displayName = "TooltipTrigger";
const TooltipContent = React.forwardRef((_a, ref) => {
    var _b, _c, _d, _e, _f, _g, _h, _j;
    var { children, className, align = "center", side = "top", sideOffset = 4, avoidCollisions = true, collisionPadding = 8, showArrow = true, arrowSize = 8, onMouseEnter, onMouseLeave } = _a, props = __rest(_a, ["children", "className", "align", "side", "sideOffset", "avoidCollisions", "collisionPadding", "showArrow", "arrowSize", "onMouseEnter", "onMouseLeave"]);
    const context = React.useContext(TooltipContext);
    const contentId = React.useRef(`tooltip-content-${Math.random().toString(36).slice(2, 10)}`);
    const [layout, setLayout] = React.useState(null);
    React.useEffect(() => {
        if (!(context === null || context === void 0 ? void 0 : context.open)) {
            setLayout(null);
            return;
        }
        let cancelled = false;
        let rafId = null;
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
            const padding = Math.max(0, collisionPadding);
            const computeForSide = (s) => {
                const isLR = s === "left" || s === "right";
                const crossStart = isLR ? triggerRect.top : triggerRect.left;
                const crossSize = isLR ? triggerRect.height : triggerRect.width;
                const contentCrossSize = isLR ? contentRect.height : contentRect.width;
                const mainOffset = sideOffset + (showArrow ? arrowSize / 2 : 0);
                const cross = (() => {
                    if (align === "start")
                        return crossStart;
                    if (align === "end")
                        return crossStart + crossSize - contentCrossSize;
                    return crossStart + crossSize / 2 - contentCrossSize / 2;
                })();
                if (s === "bottom" || s === "top") {
                    const left = cross;
                    const top = s === "bottom"
                        ? triggerRect.top + triggerRect.height + mainOffset
                        : triggerRect.top - contentRect.height - mainOffset;
                    return { left, top };
                }
                const top = cross;
                const left = s === "right"
                    ? triggerRect.left + triggerRect.width + mainOffset
                    : triggerRect.left - contentRect.width - mainOffset;
                return { left, top };
            };
            const oppositeSide = (s) => {
                if (s === "top")
                    return "bottom";
                if (s === "bottom")
                    return "top";
                if (s === "left")
                    return "right";
                return "left";
            };
            const wouldOverflowMainAxis = (s, left, top) => {
                if (s === "top")
                    return top < padding;
                if (s === "bottom")
                    return top + contentRect.height > vh - padding;
                if (s === "left")
                    return left < padding;
                return left + contentRect.width > vw - padding;
            };
            let resolvedSide = side;
            let { left, top } = computeForSide(resolvedSide);
            if (avoidCollisions && wouldOverflowMainAxis(resolvedSide, left, top)) {
                const flipped = oppositeSide(resolvedSide);
                const flippedPos = computeForSide(flipped);
                if (!wouldOverflowMainAxis(flipped, flippedPos.left, flippedPos.top)) {
                    resolvedSide = flipped;
                    left = flippedPos.left;
                    top = flippedPos.top;
                }
            }
            const maxLeft = Math.max(padding, vw - contentRect.width - padding);
            const maxTop = Math.max(padding, vh - contentRect.height - padding);
            left = Math.min(Math.max(left, padding), maxLeft);
            top = Math.min(Math.max(top, padding), maxTop);
            const triggerCenterX = triggerRect.left + triggerRect.width / 2;
            const triggerCenterY = triggerRect.top + triggerRect.height / 2;
            const arrowGap = 6;
            if (resolvedSide === "top" || resolvedSide === "bottom") {
                const rawArrowLeft = triggerCenterX - left - arrowSize / 2;
                const minArrowLeft = arrowGap;
                const maxArrowLeft = contentRect.width - arrowSize - arrowGap;
                const arrowLeft = Math.min(Math.max(rawArrowLeft, minArrowLeft), maxArrowLeft);
                setLayout({ left, top, side: resolvedSide, arrowLeft });
                return;
            }
            const rawArrowTop = triggerCenterY - top - arrowSize / 2;
            const minArrowTop = arrowGap;
            const maxArrowTop = contentRect.height - arrowSize - arrowGap;
            const arrowTop = Math.min(Math.max(rawArrowTop, minArrowTop), maxArrowTop);
            setLayout({ left, top, side: resolvedSide, arrowTop });
        };
        const schedule = () => {
            if (rafId != null) {
                if (typeof cancelAnimationFrame !== "undefined") {
                    cancelAnimationFrame(rafId);
                }
                else {
                    clearTimeout(rafId);
                }
                rafId = null;
            }
            if (typeof requestAnimationFrame !== "undefined") {
                rafId = requestAnimationFrame(() => compute());
            }
            else {
                rafId = setTimeout(() => compute(), 0);
            }
        };
        schedule();
        const onWindowChange = () => schedule();
        if (isH5() && typeof window !== "undefined") {
            window.addEventListener("resize", onWindowChange);
            window.addEventListener("scroll", onWindowChange, true);
        }
        return () => {
            cancelled = true;
            if (rafId != null) {
                if (typeof cancelAnimationFrame !== "undefined") {
                    cancelAnimationFrame(rafId);
                }
                else {
                    clearTimeout(rafId);
                }
            }
            if (isH5() && typeof window !== "undefined") {
                window.removeEventListener("resize", onWindowChange);
                window.removeEventListener("scroll", onWindowChange, true);
            }
        };
    }, [
        align,
        avoidCollisions,
        collisionPadding,
        context === null || context === void 0 ? void 0 : context.open,
        context === null || context === void 0 ? void 0 : context.triggerId,
        side,
        sideOffset,
        arrowSize,
    ]);
    if (!(context === null || context === void 0 ? void 0 : context.open))
        return null;
    const baseClassName = "fixed z-50 overflow-visible rounded-md bg-black px-3 py-2 text-sm text-white shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";
    const px = (n) => `${n}px`;
    const contentStyle = layout
        ? (isH5()
            ? { left: px(layout.left), top: px(layout.top) }
            : { left: layout.left, top: layout.top })
        : {
            left: 0,
            top: 0,
            opacity: 0,
            pointerEvents: "none",
        };
    const arrow = showArrow && layout ? (_jsx(View, { className: "absolute rotate-45 bg-black", style: layout.side === "top"
            ? (isH5()
                ? {
                    width: px(arrowSize),
                    height: px(arrowSize),
                    bottom: px(-arrowSize / 2),
                    left: px((_b = layout.arrowLeft) !== null && _b !== void 0 ? _b : 0),
                }
                : {
                    width: arrowSize,
                    height: arrowSize,
                    bottom: -arrowSize / 2,
                    left: (_c = layout.arrowLeft) !== null && _c !== void 0 ? _c : 0,
                })
            : layout.side === "bottom"
                ? (isH5()
                    ? {
                        width: px(arrowSize),
                        height: px(arrowSize),
                        top: px(-arrowSize / 2),
                        left: px((_d = layout.arrowLeft) !== null && _d !== void 0 ? _d : 0),
                    }
                    : {
                        width: arrowSize,
                        height: arrowSize,
                        top: -arrowSize / 2,
                        left: (_e = layout.arrowLeft) !== null && _e !== void 0 ? _e : 0,
                    })
                : layout.side === "left"
                    ? (isH5()
                        ? {
                            width: px(arrowSize),
                            height: px(arrowSize),
                            right: px(-arrowSize / 2),
                            top: px((_f = layout.arrowTop) !== null && _f !== void 0 ? _f : 0),
                        }
                        : {
                            width: arrowSize,
                            height: arrowSize,
                            right: -arrowSize / 2,
                            top: (_g = layout.arrowTop) !== null && _g !== void 0 ? _g : 0,
                        })
                    : (isH5()
                        ? {
                            width: px(arrowSize),
                            height: px(arrowSize),
                            left: px(-arrowSize / 2),
                            top: px((_h = layout.arrowTop) !== null && _h !== void 0 ? _h : 0),
                        }
                        : {
                            width: arrowSize,
                            height: arrowSize,
                            left: -arrowSize / 2,
                            top: (_j = layout.arrowTop) !== null && _j !== void 0 ? _j : 0,
                        }) })) : null;
    const overlay = !isH5() ? (_jsx(View, { className: "fixed inset-0 z-50 bg-transparent", onClick: () => context.onOpenChange(false) })) : null;
    return (_jsxs(Portal, { children: [overlay, _jsxs(View, Object.assign({ ref: ref, id: contentId.current, className: cn(baseClassName, className), style: contentStyle }, (isH5()
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
                : {}), props, { children: [arrow, children] }))] }));
});
TooltipContent.displayName = "TooltipContent";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
//# sourceMappingURL=tooltip.js.map