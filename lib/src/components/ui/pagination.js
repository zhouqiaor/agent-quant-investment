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
import { View, Text } from "@tarojs/components";
import { ChevronLeft, ChevronRight, Ellipsis } from "lucide-react-taro";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
const Pagination = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ role: "navigation", "aria-label": "pagination", className: cn("mx-auto flex w-full justify-center", className) }, props)));
};
Pagination.displayName = "Pagination";
const PaginationContent = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("flex flex-row items-center gap-1", className) }, props)));
});
PaginationContent.displayName = "PaginationContent";
const PaginationItem = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("", className) }, props)));
});
PaginationItem.displayName = "PaginationItem";
const PaginationLink = (_a) => {
    var { className, isActive, size = "icon" } = _a, props = __rest(_a, ["className", "isActive", "size"]);
    return (_jsx(View, Object.assign({ "aria-current": isActive ? "page" : undefined, className: cn(buttonVariants({
            variant: isActive ? "outline" : "ghost",
            size,
        }), className) }, props)));
};
PaginationLink.displayName = "PaginationLink";
const PaginationPrevious = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsxs(PaginationLink, Object.assign({ "aria-label": "Go to previous page", size: "default", className: cn("gap-1 pl-3", className) }, props, { children: [_jsx(ChevronLeft, { size: 16, color: "inherit" }), _jsx(Text, { children: "\u4E0A\u4E00\u9875" })] })));
};
PaginationPrevious.displayName = "PaginationPrevious";
const PaginationNext = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsxs(PaginationLink, Object.assign({ "aria-label": "Go to next page", size: "default", className: cn("gap-1 pr-3", className) }, props, { children: [_jsx(Text, { children: "\u4E0B\u4E00\u9875" }), _jsx(ChevronRight, { size: 16, color: "inherit" })] })));
};
PaginationNext.displayName = "PaginationNext";
const PaginationEllipsis = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsxs(View, Object.assign({ "aria-hidden": true, className: cn("flex h-9 w-9 items-center justify-center", className) }, props, { children: [_jsx(Ellipsis, { size: 16, color: "inherit" }), _jsx(View, { className: "sr-only", children: "More pages" })] })));
};
PaginationEllipsis.displayName = "PaginationEllipsis";
export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, };
//# sourceMappingURL=pagination.js.map