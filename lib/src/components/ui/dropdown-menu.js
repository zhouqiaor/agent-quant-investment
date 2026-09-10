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
import { ScrollView, View } from "@tarojs/components";
import { Check, ChevronRight } from "lucide-react-taro";
import { cn } from "@/lib/utils";
import { isH5 } from "@/lib/platform";
import { computePosition, getRectById } from "@/lib/measure";
import { Portal } from "@/components/ui/portal";
const DropdownMenuContext = React.createContext(null);
const DropdownMenu = ({ open: openProp, defaultOpen, onOpenChange, children }) => {
    const baseIdRef = React.useRef(`dropdown-menu-${Math.random().toString(36).slice(2, 10)}`);
    const [openState, setOpenState] = React.useState(defaultOpen || false);
    const open = openProp !== undefined ? openProp : openState;
    const handleOpenChange = (newOpen) => {
        if (openProp === undefined) {
            setOpenState(newOpen);
        }
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(newOpen);
    };
    return (_jsx(DropdownMenuContext.Provider, { value: { open, onOpenChange: handleOpenChange, triggerId: baseIdRef.current }, children: children }));
};
const DropdownMenuTrigger = React.forwardRef((_a, ref) => {
    var { className, children, onClick } = _a, props = __rest(_a, ["className", "children", "onClick"]);
    const context = React.useContext(DropdownMenuContext);
    return (_jsx(View, Object.assign({}, props, { ref: ref, id: context === null || context === void 0 ? void 0 : context.triggerId, "data-slot": "dropdown-menu-trigger", className: className, onClick: (e) => {
            var _a;
            e.stopPropagation();
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, !context.open);
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
        }, children: children })));
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";
const DropdownMenuGroup = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, "data-slot": "dropdown-menu-group", className: className }, props)));
});
DropdownMenuGroup.displayName = "DropdownMenuGroup";
const DropdownMenuPortal = ({ children }) => {
    return _jsx(_Fragment, { children: children });
};
const DropdownMenuRadioGroupContext = React.createContext(null);
const DropdownMenuRadioGroup = React.forwardRef((_a, ref) => {
    var { value: valueProp, defaultValue, onValueChange } = _a, props = __rest(_a, ["value", "defaultValue", "onValueChange"]);
    const [valueState, setValueState] = React.useState(defaultValue);
    const value = valueProp !== undefined ? valueProp : valueState;
    const handleValueChange = (next) => {
        if (valueProp === undefined) {
            setValueState(next);
        }
        onValueChange === null || onValueChange === void 0 ? void 0 : onValueChange(next);
    };
    return (_jsx(DropdownMenuRadioGroupContext.Provider, { value: { value, onValueChange: handleValueChange }, children: _jsx(View, Object.assign({ ref: ref }, props)) }));
});
DropdownMenuRadioGroup.displayName = "DropdownMenuRadioGroup";
const DropdownMenuSubContext = React.createContext(null);
const DropdownMenuSub = ({ open: openProp, defaultOpen, onOpenChange, children }) => {
    const parent = React.useContext(DropdownMenuContext);
    const baseIdRef = React.useRef(`dropdown-menu-sub-${Math.random().toString(36).slice(2, 10)}`);
    const [openState, setOpenState] = React.useState(defaultOpen || false);
    const open = openProp !== undefined ? openProp : openState;
    const handleOpenChange = (newOpen) => {
        if (openProp === undefined) {
            setOpenState(newOpen);
        }
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(newOpen);
    };
    React.useEffect(() => {
        if ((parent === null || parent === void 0 ? void 0 : parent.open) === false && open) {
            handleOpenChange(false);
        }
    }, [open, parent === null || parent === void 0 ? void 0 : parent.open]);
    return (_jsx(DropdownMenuSubContext.Provider, { value: { open, onOpenChange: handleOpenChange, triggerId: baseIdRef.current }, children: children }));
};
const DropdownMenuContent = React.forwardRef((_a, ref) => {
    var { className, align = "start", side = "bottom", sideOffset = 4, children } = _a, props = __rest(_a, ["className", "align", "side", "sideOffset", "children"]);
    const context = React.useContext(DropdownMenuContext);
    const contentId = React.useRef(`dropdown-menu-content-${Math.random().toString(36).slice(2, 10)}`);
    const [position, setPosition] = React.useState(null);
    React.useEffect(() => {
        if (!(context === null || context === void 0 ? void 0 : context.open)) {
            setPosition(null);
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
    }, [align, context === null || context === void 0 ? void 0 : context.open, context === null || context === void 0 ? void 0 : context.triggerId, side, sideOffset]);
    React.useEffect(() => {
        if (!(context === null || context === void 0 ? void 0 : context.open))
            return;
        if (!isH5() || typeof document === "undefined")
            return;
        const onKeyDown = (e) => {
            var _a;
            if (e.key === "Escape") {
                (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [context === null || context === void 0 ? void 0 : context.open]);
    if (!(context === null || context === void 0 ? void 0 : context.open))
        return null;
    const baseClassName = "fixed z-50 min-w-32 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground ring-opacity-10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";
    const contentStyle = position
        ? { left: position.left, top: position.top }
        : {
            left: 0,
            top: 0,
            opacity: 0,
            pointerEvents: "none",
        };
    return (_jsxs(Portal, { children: [_jsx(View, { className: "fixed inset-0 z-50 bg-transparent", onClick: () => { var _a; return (_a = context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false); } }), _jsx(View, Object.assign({}, props, { ref: ref, id: contentId.current, "data-slot": "dropdown-menu-content", "data-state": "open", "data-side": side, className: cn(baseClassName, className), style: contentStyle, onClick: (e) => e.stopPropagation(), children: _jsx(ScrollView, { scrollY: true, className: "max-h-[50vh] overflow-x-hidden overflow-y-auto", children: children }) }))] }));
});
DropdownMenuContent.displayName = "DropdownMenuContent";
const DropdownMenuItem = React.forwardRef((_a, ref) => {
    var { className, inset, variant = "default", disabled, closeOnSelect = true, onClick } = _a, props = __rest(_a, ["className", "inset", "variant", "disabled", "closeOnSelect", "onClick"]);
    const context = React.useContext(DropdownMenuContext);
    return (_jsx(View, Object.assign({}, props, { ref: ref, "data-slot": "dropdown-menu-item", "data-inset": inset ? "" : undefined, "data-variant": variant, "data-disabled": disabled ? "" : undefined, className: cn("relative flex cursor-default select-none items-center gap-1.5 rounded-md px-2 py-1 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", "data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive data-[variant=destructive]:focus:bg-opacity-10 data-[variant=destructive]:focus:text-destructive", inset && "pl-7", disabled && "pointer-events-none opacity-50", className), onClick: (e) => {
            var _a;
            if (disabled)
                return;
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
            if (closeOnSelect)
                (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
        } })));
});
DropdownMenuItem.displayName = "DropdownMenuItem";
const DropdownMenuCheckboxItem = React.forwardRef((_a, ref) => {
    var { className, children, checked, inset, disabled, closeOnSelect = false, onClick } = _a, props = __rest(_a, ["className", "children", "checked", "inset", "disabled", "closeOnSelect", "onClick"]);
    const context = React.useContext(DropdownMenuContext);
    return (_jsxs(View, Object.assign({}, props, { ref: ref, "data-slot": "dropdown-menu-checkbox-item", "data-inset": inset ? "" : undefined, "data-disabled": disabled ? "" : undefined, "data-state": checked ? "checked" : "unchecked", className: cn("relative flex cursor-default select-none items-center gap-1.5 rounded-md py-1 pr-8 pl-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", inset && "pl-7", className), onClick: (e) => {
            var _a;
            if (disabled)
                return;
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
            if (closeOnSelect)
                (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
        }, children: [_jsx(View, { className: "pointer-events-none absolute right-2 flex items-center justify-center", children: checked && _jsx(Check, { size: 16, color: "inherit" }) }), children] })));
});
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";
const DropdownMenuRadioItem = React.forwardRef((_a, ref) => {
    var { className, children, value, checked: checkedProp, inset, disabled, closeOnSelect = false, onClick } = _a, props = __rest(_a, ["className", "children", "value", "checked", "inset", "disabled", "closeOnSelect", "onClick"]);
    const context = React.useContext(DropdownMenuContext);
    const group = React.useContext(DropdownMenuRadioGroupContext);
    const checked = checkedProp !== undefined ? checkedProp : (group === null || group === void 0 ? void 0 : group.value) === value;
    return (_jsxs(View, Object.assign({}, props, { ref: ref, "data-slot": "dropdown-menu-radio-item", "data-inset": inset ? "" : undefined, "data-disabled": disabled ? "" : undefined, "data-state": checked ? "checked" : "unchecked", className: cn("relative flex cursor-default select-none items-center gap-1.5 rounded-md py-1 pr-8 pl-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", inset && "pl-7", className), onClick: (e) => {
            var _a, _b;
            if (disabled)
                return;
            (_a = group === null || group === void 0 ? void 0 : group.onValueChange) === null || _a === void 0 ? void 0 : _a.call(group, value);
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
            if (closeOnSelect)
                (_b = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _b === void 0 ? void 0 : _b.call(context, false);
        }, children: [_jsx(View, { className: "pointer-events-none absolute right-2 flex items-center justify-center", children: checked && _jsx(Check, { size: 16, color: "inherit" }) }), children] })));
});
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";
const DropdownMenuLabel = React.forwardRef((_a, ref) => {
    var { className, inset } = _a, props = __rest(_a, ["className", "inset"]);
    return (_jsx(View, Object.assign({ ref: ref, "data-slot": "dropdown-menu-label", "data-inset": inset ? "" : undefined, className: cn("px-2 py-1 text-xs font-medium text-muted-foreground", inset && "pl-7", className) }, props)));
});
DropdownMenuLabel.displayName = "DropdownMenuLabel";
const DropdownMenuSeparator = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, "data-slot": "dropdown-menu-separator", className: cn("-mx-1 my-1 h-px bg-border", className) }, props)));
});
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
const DropdownMenuShortcut = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ "data-slot": "dropdown-menu-shortcut", className: cn("ml-auto text-xs tracking-widest text-muted-foreground", className) }, props)));
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";
const DropdownMenuSubTrigger = React.forwardRef((_a, ref) => {
    var { className, inset, disabled, children, onClick } = _a, props = __rest(_a, ["className", "inset", "disabled", "children", "onClick"]);
    const subContext = React.useContext(DropdownMenuSubContext);
    return (_jsxs(View, Object.assign({}, props, { ref: ref, id: subContext === null || subContext === void 0 ? void 0 : subContext.triggerId, "data-slot": "dropdown-menu-sub-trigger", "data-inset": inset ? "" : undefined, "data-disabled": disabled ? "" : undefined, "data-state": (subContext === null || subContext === void 0 ? void 0 : subContext.open) ? "open" : "closed", className: cn("relative flex cursor-default select-none items-center gap-1.5 rounded-md px-2 py-1 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground", inset && "pl-7", disabled && "pointer-events-none opacity-50", className), onClick: (e) => {
            var _a;
            e.stopPropagation();
            if (disabled)
                return;
            (_a = subContext === null || subContext === void 0 ? void 0 : subContext.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(subContext, !subContext.open);
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
        }, children: [children, _jsx(ChevronRight, { className: "ml-auto opacity-50", size: 16, color: "inherit" })] })));
});
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";
const DropdownMenuSubContent = React.forwardRef((_a, ref) => {
    var { className, align = "start", side = "right", sideOffset = 4, children } = _a, props = __rest(_a, ["className", "align", "side", "sideOffset", "children"]);
    const parent = React.useContext(DropdownMenuContext);
    const subContext = React.useContext(DropdownMenuSubContext);
    const contentId = React.useRef(`dropdown-menu-sub-content-${Math.random().toString(36).slice(2, 10)}`);
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
    return (_jsx(Portal, { children: _jsx(View, Object.assign({}, props, { ref: ref, id: contentId.current, "data-slot": "dropdown-menu-sub-content", "data-state": "open", "data-side": side, className: cn(baseClassName, className), style: contentStyle, onClick: (e) => e.stopPropagation(), children: _jsx(ScrollView, { scrollY: true, className: "max-h-[50vh] overflow-x-hidden overflow-y-auto", children: children }) })) }));
});
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup, };
//# sourceMappingURL=dropdown-menu.js.map