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
import { Check } from "lucide-react-taro";
import { cn } from "@/lib/utils";
const Checkbox = React.forwardRef((_a, ref) => {
    var _b;
    var { className, checked: checkedProp, defaultChecked, onCheckedChange, disabled } = _a, props = __rest(_a, ["className", "checked", "defaultChecked", "onCheckedChange", "disabled"]);
    const [checkedState, setCheckedState] = React.useState(defaultChecked !== null && defaultChecked !== void 0 ? defaultChecked : false);
    const isControlled = checkedProp !== undefined;
    const checked = isControlled ? checkedProp : checkedState;
    const handleClick = (e) => {
        if (disabled)
            return;
        e.stopPropagation();
        const newChecked = !checked;
        if (!isControlled) {
            setCheckedState(newChecked);
        }
        onCheckedChange === null || onCheckedChange === void 0 ? void 0 : onCheckedChange(newChecked);
    };
    const tabIndex = (_b = props.tabIndex) !== null && _b !== void 0 ? _b : (disabled ? -1 : 0);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("h-4 w-4 shrink-0 rounded-sm border-2 border-primary ring-offset-background flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50", checked ? "bg-primary text-primary-foreground" : "bg-transparent", className) }, { tabIndex }, { hoverClass: disabled
            ? undefined
            : "border-ring ring-2 ring-ring ring-offset-2 ring-offset-background", onClick: handleClick }, props, { children: checked && _jsx(Check, { color: "#fff", size: 12, strokeWidth: 3, className: "text-current" }) })));
});
Checkbox.displayName = "Checkbox";
export { Checkbox };
//# sourceMappingURL=checkbox.js.map