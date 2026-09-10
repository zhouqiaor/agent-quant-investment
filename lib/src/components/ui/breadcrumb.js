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
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { View } from "@tarojs/components";
import { ChevronRight, Ellipsis } from "lucide-react-taro";
import { cn } from "@/lib/utils";
const Breadcrumb = React.forwardRef((_a, ref) => {
    var props = __rest(_a, []);
    return _jsx(View, Object.assign({ ref: ref, "aria-label": "breadcrumb" }, props));
});
Breadcrumb.displayName = "Breadcrumb";
const BreadcrumbList = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("flex flex-wrap items-center gap-2 break-words text-sm text-muted-foreground sm:gap-3", className) }, props)));
});
BreadcrumbList.displayName = "BreadcrumbList";
const BreadcrumbItem = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("inline-flex items-center gap-2", className) }, props)));
});
BreadcrumbItem.displayName = "BreadcrumbItem";
const BreadcrumbLink = React.forwardRef((_a, ref) => {
    var { asChild, className, href } = _a, props = __rest(_a, ["asChild", "className", "href"]);
    const linkProps = href ? { url: href } : {};
    return (_jsx(View, Object.assign({ ref: ref, className: cn("transition-colors hover:text-foreground", className) }, linkProps, props)));
});
BreadcrumbLink.displayName = "BreadcrumbLink";
const BreadcrumbPage = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, role: "link", "aria-disabled": "true", "aria-current": "page", className: cn("font-normal text-foreground", className) }, props)));
});
BreadcrumbPage.displayName = "BreadcrumbPage";
const BreadcrumbSeparator = (_a) => {
    var { children, className } = _a, props = __rest(_a, ["children", "className"]);
    return (_jsx(View, Object.assign({ role: "presentation", "aria-hidden": "true", className: cn("[&>svg]:w-4 [&>svg]:h-4 flex items-center", className) }, props, { children: children !== null && children !== void 0 ? children : _jsx(ChevronRight, { size: 16, color: "inherit" }) })));
};
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";
const BreadcrumbEllipsis = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsxs(View, Object.assign({ role: "presentation", "aria-hidden": "true", className: cn("flex h-9 w-9 items-center justify-center", className) }, props, { children: [_jsx(Ellipsis, { color: "#737373", size: 16 }), _jsx(View, { className: "sr-only", children: "More" })] })));
};
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis";
export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis, };
//# sourceMappingURL=breadcrumb.js.map