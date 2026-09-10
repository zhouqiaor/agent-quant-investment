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
import { ChevronDown } from "lucide-react-taro";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { isH5 } from "@/lib/platform";
import { computePosition, getRectById, getViewport } from "@/lib/measure";
import { Portal } from "@/components/ui/portal";
const NavigationMenuContext = React.createContext(null);
const NavigationMenu = React.forwardRef((_a, ref) => {
    var { className, children, value: valueProp, onValueChange } = _a, props = __rest(_a, ["className", "children", "value", "onValueChange"]);
    const [valueState, setValueState] = React.useState();
    const value = valueProp !== undefined ? valueProp : valueState;
    const handleValueChange = (newValue) => {
        if (valueProp === undefined) {
            setValueState(newValue);
        }
        onValueChange === null || onValueChange === void 0 ? void 0 : onValueChange(newValue);
    };
    return (_jsx(NavigationMenuContext.Provider, { value: { value, onValueChange: handleValueChange }, children: _jsx(View, Object.assign({ ref: ref, className: cn("relative z-10 flex max-w-max flex-1 items-center justify-center", className) }, props, { children: children })) }));
});
NavigationMenu.displayName = "NavigationMenu";
const NavigationMenuList = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("group flex flex-1 list-none items-center justify-center space-x-1", className) }, props)));
});
NavigationMenuList.displayName = "NavigationMenuList";
const NavigationMenuItemContext = React.createContext(null);
const NavigationMenuItem = React.forwardRef((_a, ref) => {
    var { children, value: valueProp } = _a, props = __rest(_a, ["children", "value"]);
    const id = React.useId();
    const value = valueProp || id;
    const triggerIdRef = React.useRef(`navigation-menu-trigger-${Math.random().toString(36).slice(2, 10)}`);
    return (_jsx(NavigationMenuItemContext.Provider, { value: { value, triggerId: triggerIdRef.current }, children: _jsx(View, Object.assign({ ref: ref }, props, { children: children })) }));
});
NavigationMenuItem.displayName = "NavigationMenuItem";
const navigationMenuTriggerStyle = cva("group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=open]:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:bg-opacity-50 data-[state=open]:hover:bg-accent data-[state=open]:focus:bg-accent");
const NavigationMenuTrigger = React.forwardRef((_a, ref) => {
    var { className, children } = _a, props = __rest(_a, ["className", "children"]);
    const context = React.useContext(NavigationMenuContext);
    const item = React.useContext(NavigationMenuItemContext);
    const isOpen = (context === null || context === void 0 ? void 0 : context.value) === (item === null || item === void 0 ? void 0 : item.value);
    return (_jsxs(View, Object.assign({ ref: ref, id: item === null || item === void 0 ? void 0 : item.triggerId, "data-slot": "navigation-menu-trigger", "data-state": isOpen ? "open" : "closed", className: cn(navigationMenuTriggerStyle(), "group", className), onClick: () => { var _a; return (_a = context === null || context === void 0 ? void 0 : context.onValueChange) === null || _a === void 0 ? void 0 : _a.call(context, isOpen ? undefined : item === null || item === void 0 ? void 0 : item.value); } }, props, { children: [children, " ", _jsx(ChevronDown, { className: cn("relative top-[1px] ml-1 h-3 w-3 transition duration-200", isOpen && "rotate-180"), size: 12, color: "inherit", "aria-hidden": "true" })] })));
});
NavigationMenuTrigger.displayName = "NavigationMenuTrigger";
const NavigationMenuContent = React.forwardRef((_a, ref) => {
    var { className, align = "start", side = "bottom", sideOffset = 4, children } = _a, props = __rest(_a, ["className", "align", "side", "sideOffset", "children"]);
    const context = React.useContext(NavigationMenuContext);
    const item = React.useContext(NavigationMenuItemContext);
    const isOpen = (context === null || context === void 0 ? void 0 : context.value) === (item === null || item === void 0 ? void 0 : item.value);
    const contentId = React.useRef(`navigation-menu-content-${Math.random().toString(36).slice(2, 10)}`);
    const [position, setPosition] = React.useState(null);
    const [contentWidth, setContentWidth] = React.useState(null);
    React.useEffect(() => {
        if (!isOpen) {
            setPosition(null);
            setContentWidth(null);
            return;
        }
        let cancelled = false;
        const compute = async () => {
            const triggerId = item === null || item === void 0 ? void 0 : item.triggerId;
            if (!triggerId)
                return;
            const [triggerRect, contentRect] = await Promise.all([
                getRectById(triggerId),
                getRectById(contentId.current),
            ]);
            if (cancelled)
                return;
            if (!(triggerRect === null || triggerRect === void 0 ? void 0 : triggerRect.width) || !(contentRect === null || contentRect === void 0 ? void 0 : contentRect.width))
                return;
            setContentWidth(contentRect.width);
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
    }, [align, isOpen, item === null || item === void 0 ? void 0 : item.triggerId, side, sideOffset]);
    React.useEffect(() => {
        if (!isOpen)
            return;
        if (!isH5() || typeof document === "undefined")
            return;
        const onKeyDown = (e) => {
            var _a;
            if (e.key === "Escape") {
                (_a = context === null || context === void 0 ? void 0 : context.onValueChange) === null || _a === void 0 ? void 0 : _a.call(context, undefined);
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [context, isOpen]);
    if (!isOpen)
        return null;
    const baseClassName = "fixed z-50 min-w-32 w-max max-w-[95vw] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground ring-opacity-10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";
    const vw = getViewport().width;
    const isMobileLayout = vw < 640;
    const shouldFullWidth = isMobileLayout && contentWidth !== null && contentWidth > vw - 16;
    const contentStyle = position
        ? (shouldFullWidth
            ? { left: 8, right: 8, top: position.top }
            : { left: position.left, top: position.top })
        : {
            left: shouldFullWidth ? 8 : 0,
            right: shouldFullWidth ? 8 : undefined,
            top: 0,
            opacity: 0,
            pointerEvents: "none",
        };
    return (_jsxs(Portal, { children: [_jsx(View, { className: "fixed inset-0 z-50 bg-transparent", onClick: () => { var _a; return (_a = context === null || context === void 0 ? void 0 : context.onValueChange) === null || _a === void 0 ? void 0 : _a.call(context, undefined); } }), _jsx(View, Object.assign({ ref: ref, id: contentId.current, "data-slot": "navigation-menu-content", "data-state": "open", "data-side": side, className: cn(baseClassName, className), style: contentStyle, onClick: (e) => e.stopPropagation() }, props, { children: _jsx(ScrollView, { scrollY: true, className: "max-h-[70vh] overflow-x-hidden overflow-y-auto", children: children }) }))] }));
});
NavigationMenuContent.displayName = "NavigationMenuContent";
const NavigationMenuLink = (_a) => {
    var { children, className } = _a, props = __rest(_a, ["children", "className"]);
    return (_jsx(View, Object.assign({ className: cn("block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground", className) }, props, { children: children })));
};
const NavigationMenuViewport = () => null;
const NavigationMenuIndicator = () => null;
export { navigationMenuTriggerStyle, NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuContent, NavigationMenuTrigger, NavigationMenuLink, NavigationMenuIndicator, NavigationMenuViewport, };
//# sourceMappingURL=navigation-menu.js.map