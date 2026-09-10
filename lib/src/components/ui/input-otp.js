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
import { View, Input } from "@tarojs/components";
import { Dot } from "lucide-react-taro";
import { cn } from "@/lib/utils";
const InputOTPContext = React.createContext(null);
const InputOTP = React.forwardRef(({ value: valueProp, defaultValue, onChange, maxLength, containerClassName, className, disabled, autoFocus, children }, ref) => {
    const [valueState, setValueState] = React.useState(defaultValue || "");
    const [isFocused, setIsFocused] = React.useState(false);
    const value = valueProp !== undefined ? valueProp : valueState;
    const handleChange = (e) => {
        const newValue = e.detail.value;
        if (newValue.length <= maxLength) {
            if (valueProp === undefined) {
                setValueState(newValue);
            }
            onChange === null || onChange === void 0 ? void 0 : onChange(newValue);
        }
    };
    return (_jsx(InputOTPContext.Provider, { value: { value, maxLength, isFocused }, children: _jsxs(View, { className: cn("relative flex items-center gap-2", disabled && "opacity-50", containerClassName), children: [_jsx(Input, { className: "z-10 taro-otp-hidden-input", style: {
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0,
                        zIndex: 10,
                        backgroundColor: "transparent",
                        borderWidth: 0,
                        padding: 0,
                        margin: 0,
                        outline: "none",
                        color: "transparent",
                        caretColor: "transparent",
                    }, value: value, onInput: handleChange, onFocus: () => setIsFocused(true), onBlur: () => setIsFocused(false), maxlength: maxLength, type: "number", disabled: disabled, focus: autoFocus, ref: ref }), _jsx(View, { className: cn("flex items-center gap-2", className), children: children })] }) }));
});
InputOTP.displayName = "InputOTP";
const InputOTPGroup = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("flex items-center", className) }, props)));
});
InputOTPGroup.displayName = "InputOTPGroup";
const InputOTPSlot = React.forwardRef((_a, ref) => {
    var { index, className } = _a, props = __rest(_a, ["index", "className"]);
    const context = React.useContext(InputOTPContext);
    if (!context)
        return null;
    const char = context.value[index];
    const isActive = context.isFocused && context.value.length === index;
    const hasFakeCaret = isActive;
    return (_jsxs(View, Object.assign({ ref: ref, className: cn("relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md", isActive && "z-10 ring-2 ring-ring ring-offset-background", className) }, props, { children: [_jsx(View, { children: char }), hasFakeCaret && (_jsx(View, { className: "pointer-events-none absolute inset-0 flex items-center justify-center", children: _jsx(View, { className: "h-4 w-px animate-caret-blink bg-foreground duration-1000" }) }))] })));
});
InputOTPSlot.displayName = "InputOTPSlot";
const InputOTPSeparator = React.forwardRef((_a, ref) => {
    var props = __rest(_a, []);
    return (_jsx(View, Object.assign({ ref: ref }, props, { children: _jsx(Dot, { size: 24, color: "inherit" }) })));
});
InputOTPSeparator.displayName = "InputOTPSeparator";
export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
//# sourceMappingURL=input-otp.js.map