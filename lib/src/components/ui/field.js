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
import { View, Text } from "@tarojs/components";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
function FieldSet(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ "data-slot": "field-set", className: cn("flex flex-col gap-3", className) }, props)));
}
function FieldLegend(_a) {
    var { className, variant = "legend" } = _a, props = __rest(_a, ["className", "variant"]);
    return (_jsx(View, Object.assign({ "data-slot": "field-legend", "data-variant": variant, className: cn("mb-1 font-medium", "data-[variant=legend]:text-base", "data-[variant=label]:text-sm", className) }, props)));
}
function FieldGroup(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ "data-slot": "field-group", className: cn("flex w-full flex-col gap-3 data-[slot=checkbox-group]:gap-3", className) }, props)));
}
const fieldVariants = cva("data-[invalid=true]:text-destructive flex w-full gap-1", {
    variants: {
        orientation: {
            vertical: ["flex-col [&>view]:w-full [&>label]:w-full"],
            horizontal: [
                "flex-row items-center",
            ],
            responsive: ["flex-col [&>view]:w-full [&>label]:w-full"],
        },
    },
    defaultVariants: {
        orientation: "vertical",
    },
});
function Field(_a) {
    var { className, orientation = "vertical" } = _a, props = __rest(_a, ["className", "orientation"]);
    return (_jsx(View, Object.assign({ role: "group", "data-slot": "field", "data-orientation": orientation, className: cn(fieldVariants({ orientation }), className) }, props)));
}
function FieldContent(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ "data-slot": "field-content", className: cn("flex flex-1 flex-col gap-2 leading-snug", className) }, props)));
}
function FieldLabel(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(Label, Object.assign({ "data-slot": "field-label", className: cn("flex w-fit gap-2 leading-snug", "[&>view]:p-1", className) }, props)));
}
function FieldTitle(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ "data-slot": "field-label", className: cn("flex w-fit items-center gap-2 text-sm font-medium leading-snug", className) }, props)));
}
function FieldDescription(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ "data-slot": "field-description", className: cn("text-muted-foreground text-sm font-normal leading-normal", 
        // "group-has-[[data-orientation=horizontal]]/field:text-balance", // text-balance not supported in Taro
        className) }, props)));
}
function FieldSeparator(_a) {
    var { children, className } = _a, props = __rest(_a, ["children", "className"]);
    return (_jsxs(View, Object.assign({ "data-slot": "field-separator", "data-content": !!children, className: cn("relative -my-2 h-5 text-sm", className) }, props, { children: [_jsx(Separator, { className: "absolute inset-0 top-1/2" }), children && (_jsx(View, { className: "bg-background text-muted-foreground relative mx-auto block w-fit px-2", "data-slot": "field-separator-content", children: children }))] })));
}
function FieldError(_a) {
    var _b;
    var { className, children, errors } = _a, props = __rest(_a, ["className", "children", "errors"]);
    // Memoize content if needed, or just render.
    let content = children;
    if (!content && errors) {
        if (errors.length === 1 && ((_b = errors[0]) === null || _b === void 0 ? void 0 : _b.message)) {
            content = _jsx(Text, { children: errors[0].message });
        }
        else if (errors.length > 0) {
            content = (_jsx(View, { className: "ml-4 flex flex-col gap-1", children: errors.map((error, index) => (error === null || error === void 0 ? void 0 : error.message) && _jsx(Text, { className: "text-xs", children: `\u2022 ${error.message}` }, index)) }));
        }
    }
    if (!content) {
        return null;
    }
    return (_jsx(View, Object.assign({ role: "alert", "data-slot": "field-error", className: cn("text-destructive text-sm font-normal", className) }, props, { children: content })));
}
export { Field, FieldLabel, FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSeparator, FieldSet, FieldContent, FieldTitle, };
//# sourceMappingURL=field.js.map