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
import { ScrollView } from "@tarojs/components";
import { cn } from "@/lib/utils";
const ScrollArea = React.forwardRef((_a, ref) => {
    var { className, children, orientation = "vertical" } = _a, props = __rest(_a, ["className", "children", "orientation"]);
    const scrollX = orientation === "horizontal" || orientation === "both";
    const scrollY = orientation === "vertical" || orientation === "both";
    return (_jsx(ScrollView, Object.assign({ ref: ref, className: cn("relative", className), scrollY: scrollY, scrollX: scrollX, style: {
            overflowX: scrollX ? 'auto' : 'hidden',
            overflowY: scrollY ? 'auto' : 'hidden',
        } }, props, { children: children })));
});
ScrollArea.displayName = "ScrollArea";
const ScrollBar = () => null; // Taro ScrollView handles scrollbars natively
export { ScrollArea, ScrollBar };
//# sourceMappingURL=scroll-area.js.map