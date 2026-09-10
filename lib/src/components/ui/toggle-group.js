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
import { toggleVariants } from "@/components/ui/toggle";
const ToggleGroupContext = React.createContext({
    size: "default",
    variant: "default",
    type: "single"
});
const ToggleGroup = React.forwardRef((_a, ref) => {
    var { className, variant, size, children, type = "single", value: valueProp, defaultValue, onValueChange } = _a, props = __rest(_a, ["className", "variant", "size", "children", "type", "value", "defaultValue", "onValueChange"]);
    const [valueState, setValueState] = React.useState(defaultValue || (type === "multiple" ? [] : ""));
    const value = valueProp !== undefined ? valueProp : valueState;
    const handleValueChange = (itemValue) => {
        let newValue;
        if (type === "multiple") {
            const current = Array.isArray(value) ? value : [];
            if (current.includes(itemValue)) {
                newValue = current.filter(v => v !== itemValue);
            }
            else {
                newValue = [...current, itemValue];
            }
        }
        else {
            // In Radix ToggleGroup "single", clicking active item deselects it? 
            // Actually yes, unless `rovingFocus` logic etc. 
            // But usually it behaves like radio if required=true.
            // Radix primitive has `rovingFocus` and `loop`.
            // We'll implement simple toggle logic.
            if (value === itemValue) {
                newValue = ""; // Deselect
            }
            else {
                newValue = itemValue;
            }
        }
        if (valueProp === undefined) {
            setValueState(newValue);
        }
        onValueChange === null || onValueChange === void 0 ? void 0 : onValueChange(newValue);
    };
    return (_jsx(View, Object.assign({ ref: ref, className: cn("flex items-center justify-center gap-1", className) }, props, { children: _jsx(ToggleGroupContext.Provider, { value: { variant, size, value, onValueChange: handleValueChange, type }, children: children }) })));
});
ToggleGroup.displayName = "ToggleGroup";
const ToggleGroupItem = React.forwardRef((_a, ref) => {
    var { className, children, variant, size, value, disabled } = _a, props = __rest(_a, ["className", "children", "variant", "size", "value", "disabled"]);
    const context = React.useContext(ToggleGroupContext);
    const checked = context.type === "multiple"
        ? Array.isArray(context.value) && context.value.includes(value)
        : context.value === value;
    return (_jsx(View, Object.assign({ ref: ref, className: cn(toggleVariants({
            variant: context.variant || variant,
            size: context.size || size,
        }), className, checked && "bg-accent text-accent-foreground", disabled && "opacity-50 pointer-events-none"), "data-state": checked ? "on" : "off", "data-disabled": disabled ? "" : undefined, onClick: (e) => {
            var _a, _b;
            if (disabled)
                return;
            (_a = context.onValueChange) === null || _a === void 0 ? void 0 : _a.call(context, value);
            (_b = props.onClick) === null || _b === void 0 ? void 0 : _b.call(props, e);
        } }, props, { children: children })));
});
ToggleGroupItem.displayName = "ToggleGroupItem";
export { ToggleGroup, ToggleGroupItem };
//# sourceMappingURL=toggle-group.js.map