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
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { View, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Check, ChevronRight, Circle } from "lucide-react-taro";
import { cn } from "@/lib/utils";
import { isH5 } from "@/lib/platform";
import { computePosition, getRectById, getViewport } from "@/lib/measure";
import { Portal } from "@/components/ui/portal";
const ContextMenuContext = React.createContext(null);
const ContextMenu = ({ children, onOpenChange }) => {
    const [open, setOpen] = React.useState(false);
    const [position, setPosition] = React.useState({ x: 0, y: 0 });
    const [activeSubId, setActiveSubId] = React.useState(null);
    const handleOpenChange = (newOpen) => {
        setOpen(newOpen);
        if (!newOpen)
            setActiveSubId(null);
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(newOpen);
    };
    return (_jsx(ContextMenuContext.Provider, { value: { open, onOpenChange: handleOpenChange, position, setPosition, activeSubId, setActiveSubId }, children: children }));
};
const ContextMenuTrigger = React.forwardRef((_a, ref) => {
    var { className, children, disabled } = _a, props = __rest(_a, ["className", "children", "disabled"]);
    const context = React.useContext(ContextMenuContext);
    const touchPos = React.useRef({ x: 0, y: 0 });
    const handleTrigger = (x, y) => {
        var _a;
        if (disabled)
            return;
        context === null || context === void 0 ? void 0 : context.setPosition({ x, y });
        (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, true);
    };
    if (isH5()) {
        const _b = props, { onLongPress: _onLongPress, onTouchStart: _onTouchStart } = _b, rest = __rest(_b, ["onLongPress", "onTouchStart"]);
        return (_jsx("div", Object.assign({ ref: ref, className: className, onContextMenu: (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTrigger(e.clientX, e.clientY);
            } }, rest, { children: children })));
    }
    return (_jsx(View, Object.assign({ ref: ref, className: className, onTouchStart: (e) => {
            var _a;
            const touch = (_a = e.touches) === null || _a === void 0 ? void 0 : _a[0];
            if (!touch)
                return;
            touchPos.current = { x: touch.pageX, y: touch.pageY };
        }, onLongPress: (e) => {
            e.stopPropagation();
            handleTrigger(touchPos.current.x, touchPos.current.y);
        } }, props, { children: children })));
});
ContextMenuTrigger.displayName = "ContextMenuTrigger";
const ContextMenuGroup = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: className }, props)));
});
ContextMenuGroup.displayName = "ContextMenuGroup";
const ContextMenuPortal = ({ children }) => {
    return _jsx(_Fragment, { children: children });
};
const ContextMenuContent = React.forwardRef((_a, ref) => {
    var { className, children } = _a, props = __rest(_a, ["className", "children"]);
    const context = React.useContext(ContextMenuContext);
    const contentId = React.useRef(`context-menu-${Math.random().toString(36).slice(2, 10)}`);
    const [adjustedPos, setAdjustedPos] = React.useState(null);
    React.useEffect(() => {
        if (!(context === null || context === void 0 ? void 0 : context.open)) {
            setAdjustedPos(null);
            return;
        }
        let cancelled = false;
        const compute = async () => {
            const { width: vw, height: vh } = getViewport();
            let { x, y } = context.position;
            if (isH5() && typeof document !== "undefined") {
                const el = document.getElementById(contentId.current);
                const rect = el === null || el === void 0 ? void 0 : el.getBoundingClientRect();
                if (rect) {
                    if (x + rect.width > vw)
                        x = vw - rect.width - 8;
                    if (y + rect.height > vh)
                        y = vh - rect.height - 8;
                }
                if (!cancelled)
                    setAdjustedPos({ x, y });
                return;
            }
            const query = Taro.createSelectorQuery();
            query
                .select(`#${contentId.current}`)
                .boundingClientRect((res) => {
                if (cancelled)
                    return;
                const rect = Array.isArray(res) ? res[0] : res;
                if (rect === null || rect === void 0 ? void 0 : rect.width) {
                    if (x + rect.width > vw)
                        x = vw - rect.width - 8;
                    if (y + rect.height > vh)
                        y = vh - rect.height - 8;
                }
                setAdjustedPos({ x, y });
            })
                .exec();
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
    }, [context === null || context === void 0 ? void 0 : context.open, context === null || context === void 0 ? void 0 : context.position]);
    if (!(context === null || context === void 0 ? void 0 : context.open))
        return null;
    const contentStyle = adjustedPos
        ? { left: adjustedPos.x, top: adjustedPos.y }
        : { left: context.position.x, top: context.position.y };
    return (_jsxs(Portal, { children: [_jsx(View, { className: "fixed inset-0 z-50 bg-transparent", onClick: () => { var _a; return (_a = context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false); }, 
                // @ts-ignore
                onContextMenu: (e) => {
                    var _a;
                    e.preventDefault();
                    (_a = context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
                } }), _jsx(View, Object.assign({ ref: ref, id: contentId.current, "data-slot": "context-menu-content", "data-state": "open", className: cn("fixed z-50 min-w-32 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground ring-opacity-10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className), style: contentStyle, onClick: (e) => e.stopPropagation() }, props, { children: _jsx(ScrollView, { scrollY: true, className: "max-h-[50vh] overflow-x-hidden overflow-y-auto", children: children }) }))] }));
});
ContextMenuContent.displayName = "ContextMenuContent";
const ContextMenuItem = React.forwardRef((_a, ref) => {
    var { className, inset, disabled, closeOnSelect = true, children, onClick } = _a, props = __rest(_a, ["className", "inset", "disabled", "closeOnSelect", "children", "onClick"]);
    const context = React.useContext(ContextMenuContext);
    return (_jsx(View, Object.assign({ ref: ref, "data-slot": "context-menu-item", "data-inset": inset ? "" : undefined, "data-disabled": disabled ? "" : undefined, className: cn("relative flex cursor-default select-none items-center gap-1.5 rounded-md px-2 py-1 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", inset && "pl-7", disabled && "pointer-events-none opacity-50", className), onClick: (e) => {
            var _a;
            if (disabled)
                return;
            e.stopPropagation();
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
            if (closeOnSelect)
                (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
        } }, props, { children: children })));
});
ContextMenuItem.displayName = "ContextMenuItem";
const ContextMenuRadioGroupContext = React.createContext(null);
const ContextMenuRadioGroup = React.forwardRef((_a, ref) => {
    var { value: valueProp, defaultValue, onValueChange } = _a, props = __rest(_a, ["value", "defaultValue", "onValueChange"]);
    const [valueState, setValueState] = React.useState(defaultValue);
    const value = valueProp !== undefined ? valueProp : valueState;
    const handleValueChange = (next) => {
        if (valueProp === undefined) {
            setValueState(next);
        }
        onValueChange === null || onValueChange === void 0 ? void 0 : onValueChange(next);
    };
    return (_jsx(ContextMenuRadioGroupContext.Provider, { value: { value, onValueChange: handleValueChange }, children: _jsx(View, Object.assign({ ref: ref }, props)) }));
});
ContextMenuRadioGroup.displayName = "ContextMenuRadioGroup";
const ContextMenuCheckboxItem = React.forwardRef((_a, ref) => {
    var { className, children, checked, inset, disabled, closeOnSelect = false, onClick } = _a, props = __rest(_a, ["className", "children", "checked", "inset", "disabled", "closeOnSelect", "onClick"]);
    const context = React.useContext(ContextMenuContext);
    return (_jsxs(View, Object.assign({ ref: ref, "data-slot": "context-menu-checkbox-item", "data-inset": inset ? "" : undefined, "data-disabled": disabled ? "" : undefined, "data-state": checked ? "checked" : "unchecked", className: cn("relative flex cursor-default select-none items-center gap-1.5 rounded-md py-1 pr-8 pl-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", inset && "pl-7", disabled && "pointer-events-none opacity-50", className), onClick: (e) => {
            var _a;
            if (disabled)
                return;
            e.stopPropagation();
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
            if (closeOnSelect)
                (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
        } }, props, { children: [_jsx(View, { className: "pointer-events-none absolute right-2 flex items-center justify-center", children: checked && _jsx(Check, { size: 16, color: "inherit" }) }), children] })));
});
ContextMenuCheckboxItem.displayName = "ContextMenuCheckboxItem";
const ContextMenuRadioItem = React.forwardRef((_a, ref) => {
    var { className, children, value, checked: checkedProp, inset, disabled, closeOnSelect = false, onClick } = _a, props = __rest(_a, ["className", "children", "value", "checked", "inset", "disabled", "closeOnSelect", "onClick"]);
    const context = React.useContext(ContextMenuContext);
    const group = React.useContext(ContextMenuRadioGroupContext);
    const checked = checkedProp !== undefined ? checkedProp : (group === null || group === void 0 ? void 0 : group.value) === value;
    return (_jsxs(View, Object.assign({ ref: ref, "data-slot": "context-menu-radio-item", "data-inset": inset ? "" : undefined, "data-disabled": disabled ? "" : undefined, "data-state": checked ? "checked" : "unchecked", className: cn("relative flex cursor-default select-none items-center gap-1.5 rounded-md py-1 pr-8 pl-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", inset && "pl-7", disabled && "pointer-events-none opacity-50", className), onClick: (e) => {
            var _a, _b;
            if (disabled)
                return;
            e.stopPropagation();
            (_a = group === null || group === void 0 ? void 0 : group.onValueChange) === null || _a === void 0 ? void 0 : _a.call(group, value);
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
            if (closeOnSelect)
                (_b = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _b === void 0 ? void 0 : _b.call(context, false);
        } }, props, { children: [_jsx(View, { className: "pointer-events-none absolute right-2 flex items-center justify-center", children: checked && _jsx(Circle, { className: "fill-current", size: 8, color: "inherit" }) }), children] })));
});
ContextMenuRadioItem.displayName = "ContextMenuRadioItem";
const ContextMenuLabel = React.forwardRef((_a, ref) => {
    var { className, inset } = _a, props = __rest(_a, ["className", "inset"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("px-2 py-1 text-xs font-medium text-muted-foreground", inset && "pl-7", className) }, props)));
});
ContextMenuLabel.displayName = "ContextMenuLabel";
const ContextMenuSeparator = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("-mx-1 my-1 h-px bg-border", className) }, props)));
});
ContextMenuSeparator.displayName = "ContextMenuSeparator";
const ContextMenuShortcut = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ className: cn("ml-auto text-xs tracking-widest text-muted-foreground", className) }, props)));
};
ContextMenuShortcut.displayName = "ContextMenuShortcut";
const ContextMenuSubContext = React.createContext(null);
const ContextMenuSub = ({ open: openProp, defaultOpen, onOpenChange, children }) => {
    const parent = React.useContext(ContextMenuContext);
    const baseIdRef = React.useRef(`context-menu-sub-${Math.random().toString(36).slice(2, 10)}`);
    const [openState, setOpenState] = React.useState(defaultOpen || false);
    const isActive = (parent === null || parent === void 0 ? void 0 : parent.activeSubId) === baseIdRef.current;
    const open = openProp !== undefined ? openProp : openState && isActive;
    const handleOpenChange = React.useCallback((nextOpen) => {
        if (openProp === undefined) {
            setOpenState(nextOpen);
            if (nextOpen) {
                parent === null || parent === void 0 ? void 0 : parent.setActiveSubId(baseIdRef.current);
            }
            else if ((parent === null || parent === void 0 ? void 0 : parent.activeSubId) === baseIdRef.current) {
                parent === null || parent === void 0 ? void 0 : parent.setActiveSubId(null);
            }
        }
        else {
            if (nextOpen) {
                parent === null || parent === void 0 ? void 0 : parent.setActiveSubId(baseIdRef.current);
            }
            else if ((parent === null || parent === void 0 ? void 0 : parent.activeSubId) === baseIdRef.current) {
                parent === null || parent === void 0 ? void 0 : parent.setActiveSubId(null);
            }
        }
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(nextOpen);
    }, [onOpenChange, openProp, parent]);
    React.useEffect(() => {
        if (defaultOpen) {
            setOpenState(true);
            parent === null || parent === void 0 ? void 0 : parent.setActiveSubId(baseIdRef.current);
        }
    }, []);
    React.useEffect(() => {
        if ((parent === null || parent === void 0 ? void 0 : parent.open) === false && open) {
            handleOpenChange(false);
        }
    }, [handleOpenChange, open, parent === null || parent === void 0 ? void 0 : parent.open]);
    return (_jsx(ContextMenuSubContext.Provider, { value: { open, onOpenChange: handleOpenChange, triggerId: baseIdRef.current }, children: children }));
};
const ContextMenuSubTrigger = React.forwardRef((_a, ref) => {
    var { className, inset, disabled, children, onClick } = _a, props = __rest(_a, ["className", "inset", "disabled", "children", "onClick"]);
    const subContext = React.useContext(ContextMenuSubContext);
    return (_jsxs(View, Object.assign({}, props, { ref: ref, id: subContext === null || subContext === void 0 ? void 0 : subContext.triggerId, "data-slot": "context-menu-sub-trigger", "data-inset": inset ? "" : undefined, "data-disabled": disabled ? "" : undefined, "data-state": (subContext === null || subContext === void 0 ? void 0 : subContext.open) ? "open" : "closed", className: cn("relative flex cursor-default select-none items-center gap-1.5 rounded-md px-2 py-1 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground", inset && "pl-7", disabled && "pointer-events-none opacity-50", className), onClick: (e) => {
            var _a;
            e.stopPropagation();
            if (disabled)
                return;
            (_a = subContext === null || subContext === void 0 ? void 0 : subContext.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(subContext, !subContext.open);
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
        }, children: [children, _jsx(ChevronRight, { className: "ml-auto opacity-50", size: 16, color: "inherit" })] })));
});
const ContextMenuSubContent = React.forwardRef((_a, ref) => {
    var { className, align = "start", side = "right", sideOffset = 4, children } = _a, props = __rest(_a, ["className", "align", "side", "sideOffset", "children"]);
    const parent = React.useContext(ContextMenuContext);
    const subContext = React.useContext(ContextMenuSubContext);
    const contentId = React.useRef(`context-menu-sub-content-${Math.random().toString(36).slice(2, 10)}`);
    const [position, setPosition] = React.useState(null);
    React.useEffect(() => {
        if (!(parent === null || parent === void 0 ? void 0 : parent.open) || !(subContext === null || subContext === void 0 ? void 0 : subContext.open)) {
            setPosition(null);
            return;
        }
        let cancelled = false;
        const compute = async () => {
            if (!(subContext === null || subContext === void 0 ? void 0 : subContext.triggerId))
                return;
            const [triggerRect, contentRect] = await Promise.all([
                getRectById(subContext.triggerId),
                getRectById(contentId.current),
            ]);
            if (cancelled)
                return;
            if (!(triggerRect === null || triggerRect === void 0 ? void 0 : triggerRect.width) || !(contentRect === null || contentRect === void 0 ? void 0 : contentRect.width))
                return;
            setPosition(computePosition({
                triggerRect,
                contentRect,
                align,
                side,
                sideOffset,
            }));
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
    }, [align, parent === null || parent === void 0 ? void 0 : parent.open, side, sideOffset, subContext === null || subContext === void 0 ? void 0 : subContext.open, subContext === null || subContext === void 0 ? void 0 : subContext.triggerId]);
    if (!(parent === null || parent === void 0 ? void 0 : parent.open) || !(subContext === null || subContext === void 0 ? void 0 : subContext.open))
        return null;
    const baseClassName = "fixed z-50 min-w-[96px] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground ring-opacity-10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";
    const contentStyle = position
        ? { left: position.left, top: position.top }
        : {
            left: 0,
            top: 0,
            opacity: 0,
            pointerEvents: "none",
        };
    return (_jsx(Portal, { children: _jsx(View, Object.assign({}, props, { ref: ref, id: contentId.current, "data-slot": "context-menu-sub-content", "data-state": "open", "data-side": side, className: cn(baseClassName, className), style: contentStyle, onClick: (e) => e.stopPropagation(), children: _jsx(ScrollView, { scrollY: true, className: "max-h-[50vh] overflow-x-hidden overflow-y-auto", children: children }) })) }));
});
export { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuGroup, ContextMenuPortal, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuRadioGroup, };
//# sourceMappingURL=context-menu.js.map