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
// 创建一个上下文来跟踪卡片内部的状态
const CardContext = React.createContext({
    hasHeader: false,
});
const Card = React.forwardRef((_a, ref) => {
    var { className, children } = _a, props = __rest(_a, ["className", "children"]);
    // 检查子元素中是否有 CardHeader
    const hasHeader = React.Children.toArray(children).some((child) => React.isValidElement(child) && child.type.displayName === "CardHeader");
    return (_jsx(CardContext.Provider, { value: { hasHeader }, children: _jsx(View, Object.assign({ ref: ref, className: cn("rounded-lg border bg-card text-card-foreground shadow-sm", className) }, props, { children: children })) }));
});
Card.displayName = "Card";
const CardHeader = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("flex flex-col space-y-2 p-6", className) }, props)));
});
CardHeader.displayName = "CardHeader";
const CardTitle = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("text-2xl font-semibold leading-none tracking-tight", className) }, props)));
});
CardTitle.displayName = "CardTitle";
const CardDescription = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("text-sm text-muted-foreground", className) }, props)));
});
CardDescription.displayName = "CardDescription";
const CardContent = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    const { hasHeader } = React.useContext(CardContext);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("p-6", hasHeader && "pt-0", className) }, props)));
});
CardContent.displayName = "CardContent";
const CardFooter = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    const { hasHeader } = React.useContext(CardContext);
    // 注意：Footer 通常也跟在 Content 后面，所以这里逻辑可以更精细，
    // 但为了简单通用，如果卡片有 Header，Footer 默认 pt-0 也是合理的。
    return (_jsx(View, Object.assign({ ref: ref, className: cn("flex items-center p-6", hasHeader && "pt-0", className) }, props)));
});
CardFooter.displayName = "CardFooter";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
//# sourceMappingURL=card.js.map