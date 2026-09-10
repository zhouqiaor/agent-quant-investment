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
import { Portal } from "@/components/ui/portal";
const DrawerContext = React.createContext(null);
const Drawer = (_a) => {
    var { shouldScaleBackground = true, children, open: openProp, defaultOpen, onOpenChange } = _a, props = __rest(_a, ["shouldScaleBackground", "children", "open", "defaultOpen", "onOpenChange"]);
    const [openState, setOpenState] = React.useState(defaultOpen || false);
    const open = openProp !== undefined ? openProp : openState;
    const handleOpenChange = (newOpen) => {
        if (openProp === undefined) {
            setOpenState(newOpen);
        }
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(newOpen);
    };
    return (_jsx(DrawerContext.Provider, { value: { open, onOpenChange: handleOpenChange }, children: _jsx(View, Object.assign({}, props, { children: children })) }));
};
Drawer.displayName = "Drawer";
const DrawerTrigger = React.forwardRef((_a, ref) => {
    var { className, children, asChild } = _a, props = __rest(_a, ["className", "children", "asChild"]);
    const context = React.useContext(DrawerContext);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("w-fit", className), onClick: (e) => {
            var _a;
            e.stopPropagation();
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, true);
        } }, props, { children: children })));
});
DrawerTrigger.displayName = "DrawerTrigger";
const DrawerPortal = ({ children }) => {
    const context = React.useContext(DrawerContext);
    if (!(context === null || context === void 0 ? void 0 : context.open))
        return null;
    return _jsx(Portal, { children: children });
};
const DrawerClose = React.forwardRef((_a, ref) => {
    var { className, children, asChild } = _a, props = __rest(_a, ["className", "children", "asChild"]);
    const context = React.useContext(DrawerContext);
    return (_jsx(View, Object.assign({ ref: ref, className: className, onClick: (e) => {
            var _a;
            e.stopPropagation();
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
        } }, props, { children: children })));
});
DrawerClose.displayName = "DrawerClose";
const DrawerOverlay = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    const context = React.useContext(DrawerContext);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("fixed inset-0 isolate z-50 bg-black bg-opacity-10 transition-opacity duration-100 supports-[backdrop-filter]:backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className), onClick: () => { var _a; return (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false); } }, props)));
});
DrawerOverlay.displayName = "DrawerOverlay";
const DrawerContent = React.forwardRef((_a, ref) => {
    var { className, children } = _a, props = __rest(_a, ["className", "children"]);
    return (_jsxs(DrawerPortal, { children: [_jsx(DrawerOverlay, {}), _jsxs(View, Object.assign({ ref: ref, className: cn("fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300", className) }, props, { children: [_jsx(View, { className: "mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" }), children] }))] }));
});
DrawerContent.displayName = "DrawerContent";
const DrawerHeader = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ className: cn("grid gap-2 p-4 text-center sm:text-left", className) }, props)));
};
DrawerHeader.displayName = "DrawerHeader";
const DrawerFooter = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ className: cn("mt-auto flex flex-col gap-2 p-4", className) }, props)));
};
DrawerFooter.displayName = "DrawerFooter";
const DrawerTitle = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("text-lg font-semibold leading-none tracking-tight", className) }, props)));
});
DrawerTitle.displayName = "DrawerTitle";
const DrawerDescription = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("text-sm text-muted-foreground", className) }, props)));
});
DrawerDescription.displayName = "DrawerDescription";
export { Drawer, DrawerPortal, DrawerOverlay, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription, };
//# sourceMappingURL=drawer.js.map