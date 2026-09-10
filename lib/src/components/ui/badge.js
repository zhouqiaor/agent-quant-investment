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
const badgeVariants = cva("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
    variants: {
        variant: {
            default: "border-transparent bg-primary text-primary-foreground hover:bg-primary hover:bg-opacity-80",
            secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary hover:bg-opacity-80",
            destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive hover:bg-opacity-80",
            outline: "text-foreground",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});
function Badge(_a) {
    var { className, variant } = _a, props = __rest(_a, ["className", "variant"]);
    return (_jsx(View, Object.assign({ className: cn(badgeVariants({ variant }), className) }, props)));
}
export { Badge, badgeVariants };
//# sourceMappingURL=badge.js.map