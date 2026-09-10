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
import { cn } from "@/lib/utils";
const TabsContext = React.createContext(null);
const Tabs = React.forwardRef((_a, ref) => {
    var { className, value: valueProp, defaultValue, onValueChange } = _a, props = __rest(_a, ["className", "value", "defaultValue", "onValueChange"]);
    const [valueState, setValueState] = React.useState(defaultValue);
    const value = valueProp !== undefined ? valueProp : valueState;
    const handleValueChange = (newValue) => {
        if (valueProp === undefined) {
            setValueState(newValue);
        }
        onValueChange === null || onValueChange === void 0 ? void 0 : onValueChange(newValue);
    };
    return (_jsx(TabsContext.Provider, { value: { value, onValueChange: handleValueChange }, children: _jsx(View, Object.assign({ ref: ref, className: cn(className) }, props)) }));
});
Tabs.displayName = "Tabs";
const TabsList = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className) }, props)));
});
TabsList.displayName = "TabsList";
const TabsTrigger = React.forwardRef((_a, ref) => {
    var { className, value, onClick, disabled } = _a, props = __rest(_a, ["className", "value", "onClick", "disabled"]);
    const context = React.useContext(TabsContext);
    const isActive = (context === null || context === void 0 ? void 0 : context.value) === value;
    const handleClick = (e) => {
        var _a;
        if (disabled)
            return;
        (_a = context === null || context === void 0 ? void 0 : context.onValueChange) === null || _a === void 0 ? void 0 : _a.call(context, value);
        onClick === null || onClick === void 0 ? void 0 : onClick(e);
    };
    return (_jsx(View, Object.assign({ ref: ref, onClick: handleClick, className: cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-50", isActive && "bg-background text-foreground shadow-sm", disabled && "opacity-50 pointer-events-none", className), hoverClass: disabled
            ? undefined
            : "border-ring ring-2 ring-ring ring-offset-2 ring-offset-background" }, props)));
});
TabsTrigger.displayName = "TabsTrigger";
const TabsContent = React.forwardRef((_a, ref) => {
    var { className, value } = _a, props = __rest(_a, ["className", "value"]);
    const context = React.useContext(TabsContext);
    if ((context === null || context === void 0 ? void 0 : context.value) !== value)
        return null;
    return (_jsx(View, Object.assign({ ref: ref, className: cn("mt-2 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background", className) }, props)));
});
TabsContent.displayName = "TabsContent";
export { Tabs, TabsList, TabsTrigger, TabsContent };
//# sourceMappingURL=tabs.js.map