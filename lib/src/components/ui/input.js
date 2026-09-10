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
import { Input as TaroInput, View } from "@tarojs/components";
import { cn } from "@/lib/utils";
const Input = React.forwardRef((_a, ref) => {
    var { className, type, autoFocus, focus, onFocus, onBlur } = _a, props = __rest(_a, ["className", "type", "autoFocus", "focus", "onFocus", "onBlur"]);
    const [isFocused, setIsFocused] = React.useState(false);
    const disabled = !!props.disabled;
    React.useEffect(() => {
        if (autoFocus || focus)
            setIsFocused(true);
    }, [autoFocus, focus]);
    return (_jsx(View, { className: cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:border-ring focus-within:ring-4 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background", isFocused &&
            "border-ring ring-4 ring-ring ring-offset-2 ring-offset-background", className), onTouchStart: () => {
            if (disabled)
                return;
            setIsFocused(true);
        }, children: _jsx(TaroInput, Object.assign({ type: type, className: "w-full flex-1 bg-transparent text-sm text-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 selection:bg-selection selection:text-selection-foreground", placeholderClass: "text-muted-foreground", ref: ref, focus: autoFocus || focus, onFocus: (e) => {
                setIsFocused(true);
                onFocus === null || onFocus === void 0 ? void 0 : onFocus(e);
            }, onBlur: (e) => {
                setIsFocused(false);
                onBlur === null || onBlur === void 0 ? void 0 : onBlur(e);
            } }, props)) }));
});
Input.displayName = "Input";
export { Input };
//# sourceMappingURL=input.js.map