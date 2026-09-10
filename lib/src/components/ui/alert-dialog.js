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
import { buttonVariants } from "@/components/ui/button";
import { Portal } from "@/components/ui/portal";
import { useKeyboardOffset } from "@/lib/hooks/use-keyboard-offset";
const AlertDialogContext = React.createContext(null);
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
const AlertDialog = ({ children, open: openProp, defaultOpen = false, onOpenChange }) => {
    const [openState, setOpenState] = React.useState(defaultOpen || false);
    const open = openProp !== undefined ? openProp : openState;
    const handleOpenChange = (newOpen) => {
        if (openProp === undefined) {
            setOpenState(newOpen);
        }
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(newOpen);
    };
    return (_jsx(AlertDialogContext.Provider, { value: { open, onOpenChange: handleOpenChange }, children: children }));
};
const AlertDialogTrigger = React.forwardRef((_a, ref) => {
    var { className, children } = _a, props = __rest(_a, ["className", "children"]);
    const context = React.useContext(AlertDialogContext);
    return (_jsx(View, Object.assign({ ref: ref, className: className, onClick: (e) => {
            var _a;
            e.stopPropagation();
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, true);
        } }, props, { children: children })));
});
AlertDialogTrigger.displayName = "AlertDialogTrigger";
const AlertDialogPortal = ({ children }) => {
    const context = React.useContext(AlertDialogContext);
    const present = usePresence(context === null || context === void 0 ? void 0 : context.open, 200);
    if (!present)
        return null;
    return _jsx(Portal, { children: children });
};
const AlertDialogOverlay = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    const context = React.useContext(AlertDialogContext);
    const state = (context === null || context === void 0 ? void 0 : context.open) ? "open" : "closed";
    return (_jsx(View, Object.assign({ ref: ref, "data-state": state, className: cn("fixed inset-0 isolate z-50 bg-black bg-opacity-10 transition-opacity duration-100 supports-[backdrop-filter]:backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className), onClick: (e) => {
            e.stopPropagation();
            // Unlike Dialog, AlertDialog typically forces explicit action/cancel. 
            // But user might want it to close on overlay click.
            // Standard shadcn/radix alert dialog usually does NOT close on overlay click? 
            // Radix Alert Dialog does NOT close on overlay click by default.
            // We will leave it as is (no close on click) or optional?
            // For now, let's follow standard pattern: it blocks interaction.
        } }, props)));
});
AlertDialogOverlay.displayName = "AlertDialogOverlay";
const AlertDialogContent = React.forwardRef((_a, ref) => {
    var { className, children, style } = _a, props = __rest(_a, ["className", "children", "style"]);
    const context = React.useContext(AlertDialogContext);
    const offset = useKeyboardOffset();
    const state = (context === null || context === void 0 ? void 0 : context.open) ? "open" : "closed";
    return (_jsx(AlertDialogPortal, { children: _jsxs(View, { className: "fixed inset-0 z-50", children: [_jsx(AlertDialogOverlay, {}), _jsx(View, Object.assign({ ref: ref, "data-state": state, className: cn("fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl", className), style: Object.assign(Object.assign({}, style), { top: offset > 0 ? `calc(50% - ${offset / 2}px)` : undefined }), onClick: (e) => e.stopPropagation() }, props, { children: children }))] }) }));
});
AlertDialogContent.displayName = "AlertDialogContent";
const AlertDialogHeader = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ className: cn("flex flex-col space-y-2 text-center sm:text-left", className) }, props)));
};
AlertDialogHeader.displayName = "AlertDialogHeader";
const AlertDialogFooter = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className) }, props)));
};
AlertDialogFooter.displayName = "AlertDialogFooter";
const AlertDialogTitle = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("text-lg font-semibold", className) }, props)));
});
AlertDialogTitle.displayName = "AlertDialogTitle";
const AlertDialogDescription = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("text-sm text-muted-foreground", className) }, props)));
});
AlertDialogDescription.displayName = "AlertDialogDescription";
const AlertDialogAction = React.forwardRef((_a, ref) => {
    var { className, variant, size, onClick } = _a, props = __rest(_a, ["className", "variant", "size", "onClick"]);
    const context = React.useContext(AlertDialogContext);
    return (_jsx(View, Object.assign({ ref: ref, className: cn(buttonVariants({ variant, size }), "w-full sm:w-auto", className), onClick: (e) => {
            var _a;
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
        } }, props)));
});
AlertDialogAction.displayName = "AlertDialogAction";
const AlertDialogCancel = React.forwardRef((_a, ref) => {
    var { className, variant = "outline", size, onClick } = _a, props = __rest(_a, ["className", "variant", "size", "onClick"]);
    const context = React.useContext(AlertDialogContext);
    return (_jsx(View, Object.assign({ ref: ref, className: cn(buttonVariants({ variant, size }), "mt-2 sm:mt-0 w-full sm:w-auto", className), onClick: (e) => {
            var _a;
            (_a = context === null || context === void 0 ? void 0 : context.onOpenChange) === null || _a === void 0 ? void 0 : _a.call(context, false);
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
        } }, props)));
});
AlertDialogCancel.displayName = "AlertDialogCancel";
export { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, };
//# sourceMappingURL=alert-dialog.js.map