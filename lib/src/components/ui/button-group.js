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
import { View } from "@tarojs/components";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
const buttonGroupVariants = cva("flex w-fit items-stretch", {
    variants: {
        orientation: {
            horizontal: "[&>view:nth-child(n+2)]:rounded-l-none [&>view:nth-child(n+2)]:border-l-0 [&>view:nth-last-child(n+2)]:rounded-r-none",
            vertical: "flex-col [&>view:nth-child(n+2)]:rounded-t-none [&>view:nth-child(n+2)]:border-t-0 [&>view:nth-last-child(n+2)]:rounded-b-none",
        },
    },
    defaultVariants: {
        orientation: "horizontal",
    },
});
function ButtonGroup(_a) {
    var { className, orientation } = _a, props = __rest(_a, ["className", "orientation"]);
    return (_jsx(View, Object.assign({ role: "group", "data-slot": "button-group", "data-orientation": orientation, className: cn(buttonGroupVariants({ orientation }), className) }, props)));
}
function ButtonGroupText(_a) {
    var { className, asChild = false } = _a, props = __rest(_a, ["className", "asChild"]);
    return (_jsx(View, Object.assign({ className: cn("bg-muted shadow-xs flex items-center gap-2 rounded-md border px-4 text-sm font-medium [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none", className) }, props)));
}
function ButtonGroupSeparator(_a) {
    var { className, orientation = "vertical" } = _a, props = __rest(_a, ["className", "orientation"]);
    return (_jsx(Separator, Object.assign({ "data-slot": "button-group-separator", orientation: orientation, className: cn("bg-input relative !m-0 self-stretch data-[orientation=vertical]:h-auto", className) }, props)));
}
export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants, };
//# sourceMappingURL=button-group.js.map