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
import { View, Text, Input, Textarea } from "@tarojs/components";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
const InputGroupContext = React.createContext({
    isFocused: false,
    setIsFocused: () => { },
    disabled: false,
});
function InputGroup(_a) {
    var { className, disabled } = _a, props = __rest(_a, ["className", "disabled"]);
    const [isFocused, setIsFocused] = React.useState(false);
    return (_jsx(InputGroupContext.Provider, { value: { isFocused, setIsFocused, disabled }, children: _jsx(View, Object.assign({ "data-slot": "input-group", className: cn("border-input dark:bg-input dark:bg-opacity-30 shadow-xs relative flex w-full min-h-9 flex-wrap items-center rounded-md border outline-none transition-[color,box-shadow]", isFocused && "ring-2 ring-ring ring-offset-2 ring-offset-background", className) }, props)) }));
}
const inputGroupAddonVariants = cva("text-muted-foreground flex h-auto cursor-text select-none items-center justify-center gap-2 py-1 text-sm font-medium [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4", {
    variants: {
        align: {
            "inline-start": "order-first pl-3",
            "inline-end": "order-last pr-3",
            "block-start": "[.border-b]:pb-3 order-first w-full justify-start px-3 pt-3",
            "block-end": "[.border-t]:pt-3 order-last w-full justify-start px-3 pb-3",
        },
    },
    defaultVariants: {
        align: "inline-start",
    },
});
function InputGroupAddon(_a) {
    var { className, align = "inline-start" } = _a, props = __rest(_a, ["className", "align"]);
    const { disabled } = React.useContext(InputGroupContext);
    return (_jsx(View, Object.assign({ "data-slot": "input-group-addon", "data-align": align, className: cn(inputGroupAddonVariants({ align }), disabled && "opacity-50", className) }, props)));
}
const inputGroupButtonVariants = cva("flex items-center gap-2 text-sm shadow-none", {
    variants: {
        size: {
            xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 [&>svg:not([class*='size-'])]:size-3",
            sm: "h-8 gap-2 rounded-md px-2",
            "icon-xs": "size-6 rounded-[calc(var(--radius)-5px)] p-0",
            "icon-sm": "size-8 p-0",
        },
    },
    defaultVariants: {
        size: "xs",
    },
});
function InputGroupButton(_a) {
    var { className, variant = "ghost", size = "xs" } = _a, props = __rest(_a, ["className", "variant", "size"]);
    return (_jsx(Button, Object.assign({ "data-size": size, variant: variant, className: cn(inputGroupButtonVariants({ size }), className) }, props)));
}
function InputGroupText(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(Text, Object.assign({ className: cn("text-muted-foreground flex items-center gap-2 text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none", className) }, props)));
}
function InputGroupInput(_a) {
    var { className, onFocus, onBlur, autoFocus, focus } = _a, props = __rest(_a, ["className", "onFocus", "onBlur", "autoFocus", "focus"]);
    const { setIsFocused } = React.useContext(InputGroupContext);
    return (_jsx(View, { className: "flex h-full flex-1 items-center px-2 py-2", children: _jsx(Input, Object.assign({ "data-slot": "input-group-control", className: cn("flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className), placeholderClass: "text-muted-foreground", onFocus: (e) => {
                setIsFocused(true);
                onFocus === null || onFocus === void 0 ? void 0 : onFocus(e);
            }, onBlur: (e) => {
                setIsFocused(false);
                onBlur === null || onBlur === void 0 ? void 0 : onBlur(e);
            }, focus: autoFocus || focus }, props)) }));
}
function InputGroupTextarea(_a) {
    var { className, onFocus, onBlur, autoFocus, focus } = _a, props = __rest(_a, ["className", "onFocus", "onBlur", "autoFocus", "focus"]);
    const { setIsFocused } = React.useContext(InputGroupContext);
    return (_jsx(View, { className: "flex h-full flex-1 min-w-20 m-2", children: _jsx(Textarea, Object.assign({ "data-slot": "input-group-control", className: cn("flex-1 w-full h-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className), placeholderClass: "text-muted-foreground", onFocus: (e) => {
                setIsFocused(true);
                onFocus === null || onFocus === void 0 ? void 0 : onFocus(e);
            }, onBlur: (e) => {
                setIsFocused(false);
                onBlur === null || onBlur === void 0 ? void 0 : onBlur(e);
            }, focus: autoFocus || focus }, props)) }));
}
export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea, };
//# sourceMappingURL=input-group.js.map