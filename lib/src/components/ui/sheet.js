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
import { cva } from "class-variance-authority";
import { X } from "lucide-react-taro";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal";
const SheetContext = React.createContext(null);
const usePresence = (open, durationMs) => {
    const [present, setPresent] = React.useState(!!open);
    const timeoutRef = React.useRef(null);
    React.useEffect(() => {
        if (open) {
            if (timeoutRef.current)
                clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
            setPresent(true);
            return;
        }
        timeoutRef.current = setTimeout(() => setPresent(false), durationMs);
        return () => {
            if (timeoutRef.current)
                clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        };
    }, [open, durationMs]);
    return present;
};
const Sheet = ({ children, open: openProp, defaultOpen, onOpenChange }) => {
    const [openState, setOpenState] = React.useState(defaultOpen || false);
    const open = openProp !== undefined ? openProp : openState;
    const handleOpenChange = (newOpen) => {
        if (openProp === undefined) {
            setOpenState(newOpen);
        }
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(newOpen);
    };
    return (_jsx(SheetContext.Provider, { value: { open, onOpenChange: handleOpenChange }, children: children }));
};
const SheetTrigger = React.forwardRef((_a, ref) => {
    var { className, children, asChild } = _a, props = __rest(_a, ["className", "children", "asChild"]);
    const context = React.useContext(SheetContext);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("w-fit", className), onClick: (e) => {
            var _a;
            e.stopPropagation();
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, true);
        } }, props, { children: children })));
});
SheetTrigger.displayName = "SheetTrigger";
const SheetClose = React.forwardRef((_a, ref) => {
    var { className, children, asChild } = _a, props = __rest(_a, ["className", "children", "asChild"]);
    const context = React.useContext(SheetContext);
    return (_jsx(View, Object.assign({ ref: ref, className: className, onClick: (e) => {
            var _a;
            e.stopPropagation();
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
        } }, props, { children: children })));
});
SheetClose.displayName = "SheetClose";
const SheetPortal = ({ children }) => {
    const context = React.useContext(SheetContext);
    const present = usePresence(context === null || context === void 0 ? void 0 : context.open, 300);
    if (!present)
        return null;
    return _jsx(Portal, { children: children });
};
const SheetOverlay = React.forwardRef((_a, ref) => {
    var { className, onClick } = _a, props = __rest(_a, ["className", "onClick"]);
    const context = React.useContext(SheetContext);
    const state = (context === null || context === void 0 ? void 0 : context.open) ? "open" : "closed";
    return (_jsx(View, Object.assign({ "data-state": state, className: cn("fixed inset-0 isolate z-50 bg-black bg-opacity-10 transition-opacity duration-100 supports-[backdrop-filter]:backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className) }, props, { ref: ref, onClick: (e) => {
            var _a;
            e.stopPropagation();
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
        } })));
});
SheetOverlay.displayName = "SheetOverlay";
const sheetVariants = cva("fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500", {
    variants: {
        side: {
            top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
            bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
            right: "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
        },
    },
    defaultVariants: {
        side: "right",
    },
});
const SheetContent = React.forwardRef((_a, ref) => {
    var { side = "right", className, children } = _a, props = __rest(_a, ["side", "className", "children"]);
    const context = React.useContext(SheetContext);
    const state = (context === null || context === void 0 ? void 0 : context.open) ? "open" : "closed";
    return (_jsx(SheetPortal, { children: _jsxs(View, { className: "fixed inset-0 z-50", onClick: () => { var _a; return (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false); }, children: [_jsx(SheetOverlay, {}), _jsxs(View, Object.assign({ ref: ref, className: cn(sheetVariants({ side }), "sheet-content", className), "data-state": state, "data-side": side, onClick: (e) => e.stopPropagation() }, props, { children: [children, _jsxs(View, { className: "absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary", "data-state": state, onClick: (e) => {
                                var _a;
                                e.stopPropagation();
                                (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
                            }, children: [_jsx(X, { size: 16, color: "inherit" }), _jsx(View, { className: "sr-only", children: "Close" })] })] }))] }) }));
});
SheetContent.displayName = "SheetContent";
const SheetHeader = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ className: cn("flex flex-col space-y-2 text-center sm:text-left", className) }, props)));
};
SheetHeader.displayName = "SheetHeader";
const SheetFooter = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className) }, props)));
};
SheetFooter.displayName = "SheetFooter";
const SheetTitle = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("text-lg font-semibold text-foreground", className) }, props)));
});
SheetTitle.displayName = "SheetTitle";
const SheetDescription = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("text-sm text-muted-foreground", className) }, props)));
});
SheetDescription.displayName = "SheetDescription";
export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, };
//# sourceMappingURL=sheet.js.map