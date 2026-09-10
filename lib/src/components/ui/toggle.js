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
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const toggleVariants = cva("inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 gap-2", {
    variants: {
        variant: {
            default: "bg-transparent",
            outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
        },
        size: {
            default: "h-10 px-3 min-w-10",
            sm: "h-9 px-3 min-w-9",
            lg: "h-11 px-5 min-w-11",
        },
    },
    defaultVariants: {
        variant: "default",
        size: "default",
    },
});
const Toggle = React.forwardRef((_a, ref) => {
    var _b;
    var { className, variant, size, pressed: pressedProp, defaultPressed, onPressedChange, disabled } = _a, props = __rest(_a, ["className", "variant", "size", "pressed", "defaultPressed", "onPressedChange", "disabled"]);
    const [pressedState, setPressedState] = React.useState(defaultPressed || false);
    const pressed = pressedProp !== undefined ? pressedProp : pressedState;
    const handleClick = (e) => {
        var _a;
        if (disabled)
            return;
        const newPressed = !pressed;
        if (pressedProp === undefined) {
            setPressedState(newPressed);
        }
        onPressedChange === null || onPressedChange === void 0 ? void 0 : onPressedChange(newPressed);
        (_a = props.onClick) === null || _a === void 0 ? void 0 : _a.call(props, e);
    };
    const tabIndex = (_b = props.tabIndex) !== null && _b !== void 0 ? _b : (disabled ? -1 : 0);
    return (_jsx(View, Object.assign({ ref: ref, className: cn(toggleVariants({ variant, size, className }), pressed && "bg-accent text-accent-foreground", disabled && "opacity-50 pointer-events-none"), "data-state": pressed ? "on" : "off", "data-disabled": disabled ? "" : undefined }, { tabIndex }, { hoverClass: disabled
            ? undefined
            : "border-ring ring-2 ring-ring ring-offset-2 ring-offset-background", onClick: handleClick }, props)));
});
Toggle.displayName = "Toggle";
export { Toggle, toggleVariants };
//# sourceMappingURL=toggle.js.map