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
import { View, ScrollView } from "@tarojs/components";
import { Check, ChevronDown, ChevronUp } from "lucide-react-taro";
import { cn } from "@/lib/utils";
import { getRectById, getViewport } from "@/lib/measure";
import { Portal } from "@/components/ui/portal";
const SelectContext = React.createContext(null);
const Select = ({ value: valueProp, defaultValue, onValueChange, open: openProp, defaultOpen, onOpenChange, children, }) => {
    const baseIdRef = React.useRef(`select-${Math.random().toString(36).slice(2, 10)}`);
    const [openState, setOpenState] = React.useState(defaultOpen || false);
    const open = openProp !== undefined ? openProp : openState;
    const [valueState, setValueState] = React.useState(defaultValue || "");
    const value = valueProp !== undefined ? valueProp : valueState;
    const [selectedLabel, setSelectedLabel] = React.useState(undefined);
    const handleOpenChange = (newOpen) => {
        if (openProp === undefined) {
            setOpenState(newOpen);
        }
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(newOpen);
    };
    const handleValueChange = (newValue) => {
        if (valueProp === undefined) {
            setValueState(newValue);
        }
        onValueChange === null || onValueChange === void 0 ? void 0 : onValueChange(newValue);
        handleOpenChange(false);
    };
    return (_jsx(SelectContext.Provider, { value: {
            value,
            onValueChange: handleValueChange,
            open,
            onOpenChange: handleOpenChange,
            triggerId: baseIdRef.current,
            selectedLabel,
            setSelectedLabel,
        }, children: children }));
};
const SelectGroup = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("scroll-my-1 p-1", className) }, props)));
});
SelectGroup.displayName = "SelectGroup";
const SelectValue = React.forwardRef((_a, ref) => {
    var { className, placeholder, children } = _a, props = __rest(_a, ["className", "placeholder", "children"]);
    const context = React.useContext(SelectContext);
    const hasValue = !!(context === null || context === void 0 ? void 0 : context.value);
    const displayValue = children
        ? children
        : (context === null || context === void 0 ? void 0 : context.selectedLabel) || (context === null || context === void 0 ? void 0 : context.value) || placeholder;
    return (_jsx(View, Object.assign({ ref: ref, className: cn("flex flex-1 text-left", !hasValue && !children && "text-muted-foreground", className) }, props, { children: displayValue })));
});
SelectValue.displayName = "SelectValue";
const SelectTrigger = React.forwardRef((_a, ref) => {
    var { className, size = "default", disabled, children, onClick } = _a, props = __rest(_a, ["className", "size", "disabled", "children", "onClick"]);
    const context = React.useContext(SelectContext);
    return (_jsxs(View, Object.assign({ ref: ref }, props, { id: context === null || context === void 0 ? void 0 : context.triggerId, className: cn("flex w-fit items-center justify-between gap-2 rounded-lg border border-input bg-transparent pr-2 pl-3 text-sm whitespace-nowrap transition-colors outline-none select-none focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4", size === "default" && "h-8 py-2", size === "sm" && "h-7 py-1 rounded-[10px]", (context === null || context === void 0 ? void 0 : context.open) &&
            "border-ring ring-2 ring-ring ring-offset-2 ring-offset-background", className), hoverClass: disabled
            ? undefined
            : "border-ring ring-2 ring-ring ring-offset-2 ring-offset-background", onClick: (e) => {
            var _a;
            if (disabled)
                return;
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
            e.stopPropagation();
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, !context.open);
        }, children: [children, _jsx(ChevronDown, { className: "text-muted-foreground", size: 16, color: "inherit" })] })));
});
SelectTrigger.displayName = "SelectTrigger";
const SelectScrollUpButton = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ className: cn("flex cursor-default items-center justify-center py-1", className) }, props, { children: _jsx(ChevronUp, { size: 16, color: "inherit" }) })));
};
SelectScrollUpButton.displayName = "SelectScrollUpButton";
const SelectScrollDownButton = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ className: cn("flex cursor-default items-center justify-center py-1", className) }, props, { children: _jsx(ChevronDown, { size: 16, color: "inherit" }) })));
};
SelectScrollDownButton.displayName = "SelectScrollDownButton";
const SelectContent = React.forwardRef((_a, ref) => {
    var { className, children, side = "bottom", sideOffset = 4, align = "center", alignOffset = 0, alignItemWithTrigger = true, onClick } = _a, props = __rest(_a, ["className", "children", "side", "sideOffset", "align", "alignOffset", "alignItemWithTrigger", "onClick"]);
    const context = React.useContext(SelectContext);
    const contentId = React.useRef(`select-content-${Math.random().toString(36).slice(2, 10)}`);
    const [position, setPosition] = React.useState(null);
    const [anchorWidth, setAnchorWidth] = React.useState(null);
    React.useEffect(() => {
        if (!(context === null || context === void 0 ? void 0 : context.open)) {
            setPosition(null);
            setAnchorWidth(null);
            return;
        }
        let cancelled = false;
        const compute = async () => {
            if (!(context === null || context === void 0 ? void 0 : context.triggerId))
                return;
            const [triggerRect, contentRect] = await Promise.all([
                getRectById(context.triggerId),
                getRectById(contentId.current),
            ]);
            if (cancelled)
                return;
            if (!(triggerRect === null || triggerRect === void 0 ? void 0 : triggerRect.width) || !(contentRect === null || contentRect === void 0 ? void 0 : contentRect.width))
                return;
            const { width: vw, height: vh } = getViewport();
            const margin = 8;
            const contentMainSize = alignItemWithTrigger && (side === "bottom" || side === "top")
                ? triggerRect.width
                : side === "left" || side === "right"
                    ? contentRect.height
                    : contentRect.width;
            const crossStart = side === "left" || side === "right" ? triggerRect.top : triggerRect.left;
            const crossSize = side === "left" || side === "right" ? triggerRect.height : triggerRect.width;
            const contentCrossSize = (() => {
                if (side === "left" || side === "right")
                    return contentRect.height;
                return alignItemWithTrigger ? triggerRect.width : contentRect.width;
            })();
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
                left = cross + alignOffset;
                top =
                    side === "bottom"
                        ? triggerRect.top + triggerRect.height + sideOffset
                        : triggerRect.top - contentRect.height - sideOffset;
            }
            else {
                top = cross + alignOffset;
                left =
                    side === "right"
                        ? triggerRect.left + triggerRect.width + sideOffset
                        : triggerRect.left - contentRect.width - sideOffset;
            }
            const clampWidth = side === "bottom" || side === "top" ? contentMainSize : contentRect.width;
            const clampHeight = side === "left" || side === "right" ? contentMainSize : contentRect.height;
            left = Math.min(Math.max(left, margin), vw - clampWidth - margin);
            top = Math.min(Math.max(top, margin), vh - clampHeight - margin);
            setAnchorWidth(triggerRect.width);
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
    }, [
        align,
        alignOffset,
        alignItemWithTrigger,
        context === null || context === void 0 ? void 0 : context.open,
        context === null || context === void 0 ? void 0 : context.triggerId,
        side,
        sideOffset,
    ]);
    if (!(context === null || context === void 0 ? void 0 : context.open))
        return null;
    const contentStyle = position
        ? {
            left: position.left,
            top: position.top,
            width: alignItemWithTrigger && anchorWidth ? anchorWidth : undefined,
        }
        : {
            left: 0,
            top: 0,
            opacity: 0,
            pointerEvents: "none",
        };
    return (_jsxs(Portal, { children: [_jsx(View, { className: "fixed inset-0 z-50 bg-transparent", onClick: () => { var _a; return (_a = context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false); } }), _jsxs(View, Object.assign({ ref: ref, id: contentId.current, className: cn("fixed z-50 min-w-36 overflow-x-hidden overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md", className), style: contentStyle, onClick: (e) => {
                    onClick === null || onClick === void 0 ? void 0 : onClick(e);
                    e.stopPropagation();
                } }, props, { children: [_jsx(SelectScrollUpButton, { className: "hidden" }), _jsx(ScrollView, { scrollY: true, className: "max-h-[50vh]", children: children }), _jsx(SelectScrollDownButton, { className: "hidden" })] }))] }));
});
SelectContent.displayName = "SelectContent";
const SelectLabel = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("px-2 py-1 text-xs text-muted-foreground", className) }, props)));
});
SelectLabel.displayName = "SelectLabel";
const SelectItem = React.forwardRef((_a, ref) => {
    var { className, children, value, disabled, onClick } = _a, props = __rest(_a, ["className", "children", "value", "disabled", "onClick"]);
    const context = React.useContext(SelectContext);
    const isSelected = (context === null || context === void 0 ? void 0 : context.value) === value;
    const labelText = React.useMemo(() => {
        if (typeof children === "string")
            return children;
        if (Array.isArray(children) && children.every((c) => typeof c === "string")) {
            return children.join("");
        }
        return undefined;
    }, [children]);
    React.useEffect(() => {
        var _a;
        if (isSelected && labelText) {
            (_a = context === null || context === void 0 ? void 0 : context.setSelectedLabel) === null || _a === void 0 ? void 0 : _a.call(context, labelText);
        }
    }, [context, isSelected, labelText]);
    return (_jsxs(View, Object.assign({ ref: ref, className: cn("relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-2 text-sm outline-none select-none transition-colors focus:bg-accent focus:text-accent-foreground", disabled && "opacity-50 pointer-events-none", className), onClick: (e) => {
            var _a, _b;
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
            if (disabled)
                return;
            e.stopPropagation();
            (_a = context === null || context === void 0 ? void 0 : context.setSelectedLabel) === null || _a === void 0 ? void 0 : _a.call(context, labelText);
            (_b = context === null || context === void 0 ? void 0 : context.onValueChange) === null || _b === void 0 ? void 0 : _b.call(context, value);
        } }, props, { children: [_jsx(View, { className: "flex flex-1 shrink-0 gap-2 whitespace-nowrap", children: children }), isSelected ? (_jsx(View, { className: "pointer-events-none absolute right-2 flex h-4 w-4 items-center justify-center", children: _jsx(Check, { size: 16, color: "inherit" }) })) : null] })));
});
SelectItem.displayName = "SelectItem";
const SelectSeparator = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("pointer-events-none -mx-1 my-1 h-px bg-border", className) }, props)));
});
SelectSeparator.displayName = "SelectSeparator";
export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton, };
//# sourceMappingURL=select.js.map