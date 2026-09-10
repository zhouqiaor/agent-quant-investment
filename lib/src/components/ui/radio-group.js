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
const RadioGroupContext = React.createContext(null);
const RadioGroup = React.forwardRef((_a, ref) => {
    var { className, value: valueProp, defaultValue, onValueChange } = _a, props = __rest(_a, ["className", "value", "defaultValue", "onValueChange"]);
    const [valueState, setValueState] = React.useState(defaultValue);
    const value = valueProp !== undefined ? valueProp : valueState;
    const handleValueChange = (newValue) => {
        if (valueProp === undefined) {
            setValueState(newValue);
        }
        onValueChange === null || onValueChange === void 0 ? void 0 : onValueChange(newValue);
    };
    return (_jsx(RadioGroupContext.Provider, { value: { value, onValueChange: handleValueChange }, children: _jsx(View, Object.assign({ className: cn("grid gap-2", className) }, props, { ref: ref })) }));
});
RadioGroup.displayName = "RadioGroup";
const RadioGroupItem = React.forwardRef((_a, ref) => {
    var { className, value } = _a, props = __rest(_a, ["className", "value"]);
    const context = React.useContext(RadioGroupContext);
    const checked = (context === null || context === void 0 ? void 0 : context.value) === value;
    return (_jsx(View, Object.assign({ ref: ref, className: cn("aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", checked && "border-10", className), onClick: () => { var _a; return (_a = context === null || context === void 0 ? void 0 : context.onValueChange) === null || _a === void 0 ? void 0 : _a.call(context, value); } }, props)));
});
RadioGroupItem.displayName = "RadioGroupItem";
export { RadioGroup, RadioGroupItem };
//# sourceMappingURL=radio-group.js.map