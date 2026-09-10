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
import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { View } from "@tarojs/components";
const CollapsibleContext = React.createContext(null);
const Collapsible = React.forwardRef((_a, ref) => {
    var { open: openProp, defaultOpen, onOpenChange, disabled } = _a, props = __rest(_a, ["open", "defaultOpen", "onOpenChange", "disabled"]);
    const [openState, setOpenState] = React.useState(defaultOpen || false);
    const open = openProp !== undefined ? openProp : openState;
    const handleOpenChange = (newOpen) => {
        if (disabled)
            return;
        if (openProp === undefined) {
            setOpenState(newOpen);
        }
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(newOpen);
    };
    return (_jsx(CollapsibleContext.Provider, { value: { open, onOpenChange: handleOpenChange }, children: _jsx(View, Object.assign({ ref: ref }, props)) }));
});
Collapsible.displayName = "Collapsible";
const CollapsibleTrigger = React.forwardRef((_a, ref) => {
    var { className, onClick, asChild } = _a, props = __rest(_a, ["className", "onClick", "asChild"]);
    const context = React.useContext(CollapsibleContext);
    return (_jsx(View, Object.assign({ ref: ref, className: className, onClick: (e) => {
            context === null || context === void 0 ? void 0 : context.onOpenChange(!context.open);
            onClick === null || onClick === void 0 ? void 0 : onClick(e);
        } }, props)));
});
CollapsibleTrigger.displayName = "CollapsibleTrigger";
const CollapsibleContent = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    const context = React.useContext(CollapsibleContext);
    if (!(context === null || context === void 0 ? void 0 : context.open))
        return null;
    return _jsx(View, Object.assign({ ref: ref, className: className }, props));
});
CollapsibleContent.displayName = "CollapsibleContent";
export { Collapsible, CollapsibleTrigger, CollapsibleContent };
//# sourceMappingURL=collapsible.js.map