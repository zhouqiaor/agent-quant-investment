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
import { X } from "lucide-react-taro";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal";
import { useKeyboardOffset } from "@/lib/hooks/use-keyboard-offset";
const DialogContext = React.createContext(null);
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
const Dialog = ({ children, open: openProp, defaultOpen, onOpenChange }) => {
    const [openState, setOpenState] = React.useState(defaultOpen || false);
    const open = openProp !== undefined ? openProp : openState;
    const handleOpenChange = (newOpen) => {
        if (openProp === undefined) {
            setOpenState(newOpen);
        }
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(newOpen);
    };
    return (_jsx(DialogContext.Provider, { value: { open, onOpenChange: handleOpenChange }, children: children }));
};
const DialogTrigger = React.forwardRef((_a, ref) => {
    var { className, children, asChild } = _a, props = __rest(_a, ["className", "children", "asChild"]);
    const context = React.useContext(DialogContext);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("w-fit", className), onClick: (e) => {
            var _a;
            e.stopPropagation();
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, true);
        } }, props, { children: children })));
});
DialogTrigger.displayName = "DialogTrigger";
const DialogPortal = ({ children }) => {
    const context = React.useContext(DialogContext);
    const present = usePresence(context === null || context === void 0 ? void 0 : context.open, 200);
    if (!present)
        return null;
    return _jsx(Portal, { children: children });
};
const DialogOverlay = React.forwardRef((_a, ref) => {
    var { className, onClick } = _a, props = __rest(_a, ["className", "onClick"]);
    const context = React.useContext(DialogContext);
    const state = (context === null || context === void 0 ? void 0 : context.open) ? "open" : "closed";
    return (_jsx(View, Object.assign({ ref: ref, "data-state": state, className: cn("fixed inset-0 isolate z-50 bg-black bg-opacity-10 transition-opacity duration-100 supports-[backdrop-filter]:backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className), onClick: (e) => {
            var _a;
            e.stopPropagation();
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
        } }, props)));
});
DialogOverlay.displayName = "DialogOverlay";
const DialogContent = React.forwardRef((_a, ref) => {
    var { className, children, style, closeClassName } = _a, props = __rest(_a, ["className", "children", "style", "closeClassName"]);
    const context = React.useContext(DialogContext);
    const offset = useKeyboardOffset();
    const state = (context === null || context === void 0 ? void 0 : context.open) ? "open" : "closed";
    return (_jsx(DialogPortal, { children: _jsxs(View, { className: "fixed inset-0 z-50", onClick: () => { var _a; return (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false); }, children: [_jsx(DialogOverlay, {}), _jsxs(View, Object.assign({ ref: ref, "data-state": state, className: cn("fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl", className), style: Object.assign(Object.assign({}, style), { top: offset > 0 ? `calc(50% - ${offset / 2}px)` : undefined }), onClick: (e) => e.stopPropagation() }, props, { children: [children, _jsxs(View, { "data-slot": "dialog-close", className: cn("absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground", closeClassName), "data-state": state, onClick: (e) => {
                                var _a;
                                e.stopPropagation();
                                (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
                            }, children: [_jsx(X, { size: 16, color: "inherit" }), _jsx(View, { className: "sr-only", children: "Close" })] })] }))] }) }));
});
DialogContent.displayName = "DialogContent";
const DialogHeader = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ className: cn("flex flex-col space-y-2 text-center sm:text-left", className) }, props)));
};
DialogHeader.displayName = "DialogHeader";
const DialogFooter = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className) }, props)));
};
DialogFooter.displayName = "DialogFooter";
const DialogTitle = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("text-lg font-semibold leading-none tracking-tight", className) }, props)));
});
DialogTitle.displayName = "DialogTitle";
const DialogDescription = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("text-sm text-muted-foreground", className) }, props)));
});
DialogDescription.displayName = "DialogDescription";
const DialogClose = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    const context = React.useContext(DialogContext);
    return (_jsx(View, Object.assign({ ref: ref, className: className, onClick: (e) => {
            var _a;
            e.stopPropagation();
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
        } }, props)));
});
DialogClose.displayName = "DialogClose";
export { Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, };
//# sourceMappingURL=dialog.js.map