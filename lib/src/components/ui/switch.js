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
const Switch = React.forwardRef((_a, ref) => {
    var { className, checked, defaultChecked, onCheckedChange, disabled } = _a, props = __rest(_a, ["className", "checked", "defaultChecked", "onCheckedChange", "disabled"]);
    const [localChecked, setLocalChecked] = React.useState(defaultChecked || false);
    const isControlled = checked !== undefined;
    const currentChecked = isControlled ? checked : localChecked;
    return (_jsx(View, Object.assign({ className: cn("inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background [-webkit-tap-highlight-color:transparent]", disabled && "cursor-not-allowed opacity-50", currentChecked ? "bg-primary" : "bg-input", className), "data-state": currentChecked ? "checked" : "unchecked", hoverClass: disabled
            ? undefined
            : "border-ring ring-2 ring-ring ring-offset-2 ring-offset-background" }, props, { ref: ref, onClick: (e) => {
            if (disabled)
                return;
            e.stopPropagation();
            const newChecked = !currentChecked;
            if (!isControlled) {
                setLocalChecked(newChecked);
            }
            onCheckedChange === null || onCheckedChange === void 0 ? void 0 : onCheckedChange(newChecked);
        }, children: _jsx(View, { className: cn("pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform", currentChecked ? "translate-x-5" : "translate-x-0") }) })));
});
Switch.displayName = "Switch";
export { Switch };
//# sourceMappingURL=switch.js.map