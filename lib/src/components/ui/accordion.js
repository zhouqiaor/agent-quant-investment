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
import { ChevronsUpDown } from "lucide-react-taro";
import { cn } from "@/lib/utils";
const AccordionContext = React.createContext(null);
const Accordion = React.forwardRef((_a, ref) => {
    var { className, type = "single", value: valueProp, defaultValue, onValueChange, collapsible = false } = _a, props = __rest(_a, ["className", "type", "value", "defaultValue", "onValueChange", "collapsible"]);
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
            if (value === itemValue && collapsible) {
                newValue = "";
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
    return (_jsx(AccordionContext.Provider, { value: { value, onValueChange: handleValueChange, type }, children: _jsx(View, Object.assign({ ref: ref, className: className }, props)) }));
});
Accordion.displayName = "Accordion";
const AccordionItem = React.forwardRef((_a, ref) => {
    var { className, value } = _a, props = __rest(_a, ["className", "value"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("border-b", className) }, props, { "data-value": value })));
});
AccordionItem.displayName = "AccordionItem";
const AccordionTrigger = React.forwardRef((_a, ref) => {
    var { className, children } = _a, props = __rest(_a, ["className", "children"]);
    // Need to find the parent AccordionItem's value. 
    // In React Native/Taro we can't easily traverse up DOM. 
    // So we assume AccordionItem passes context or we need to explicitly pass value?
    // Radix does this via context nesting. 
    // Let's create a context for Item.
    return (_jsx(AccordionItemContext.Consumer, { children: (itemValue) => _jsx(AccordionTriggerInternal, Object.assign({ itemValue: itemValue, className: className, ref: ref }, props, { children: children })) }));
});
AccordionTrigger.displayName = "AccordionTrigger";
// Helper context for Item
const AccordionItemContext = React.createContext("");
// Update AccordionItem to provide context
const AccordionItemWithContext = React.forwardRef((_a, ref) => {
    var { className, value, children } = _a, props = __rest(_a, ["className", "value", "children"]);
    return (_jsx(AccordionItemContext.Provider, { value: value, children: _jsx(View, Object.assign({ ref: ref, className: cn("border-b", className) }, props, { children: children })) }));
});
AccordionItemWithContext.displayName = "AccordionItem";
const AccordionTriggerInternal = React.forwardRef((_a, ref) => {
    var { className, children, itemValue } = _a, props = __rest(_a, ["className", "children", "itemValue"]);
    const context = React.useContext(AccordionContext);
    const isOpen = Array.isArray(context === null || context === void 0 ? void 0 : context.value)
        ? context === null || context === void 0 ? void 0 : context.value.includes(itemValue)
        : (context === null || context === void 0 ? void 0 : context.value) === itemValue;
    return (_jsx(View, { className: "flex", children: _jsxs(View, Object.assign({ ref: ref, className: cn("flex flex-1 items-center justify-between py-4 font-medium transition-all", className), onClick: () => { var _a; return (_a = context === null || context === void 0 ? void 0 : context.onValueChange) === null || _a === void 0 ? void 0 : _a.call(context, itemValue); } }, props, { children: [children, _jsx(ChevronsUpDown, { className: cn("shrink-0 transition-transform duration-200", isOpen && "rotate-180"), size: 16, color: "inherit" })] })) }));
});
const AccordionContent = React.forwardRef((_a, ref) => {
    var { className, children } = _a, props = __rest(_a, ["className", "children"]);
    return (_jsx(AccordionItemContext.Consumer, { children: (itemValue) => _jsx(AccordionContentInternal, Object.assign({ itemValue: itemValue, className: className, ref: ref }, props, { children: children })) }));
});
AccordionContent.displayName = "AccordionContent";
const AccordionContentInternal = React.forwardRef((_a, ref) => {
    var { className, children, itemValue } = _a, props = __rest(_a, ["className", "children", "itemValue"]);
    const context = React.useContext(AccordionContext);
    const isOpen = Array.isArray(context === null || context === void 0 ? void 0 : context.value)
        ? context === null || context === void 0 ? void 0 : context.value.includes(itemValue)
        : (context === null || context === void 0 ? void 0 : context.value) === itemValue;
    if (!isOpen)
        return null;
    return (_jsx(View, Object.assign({ ref: ref, className: "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down" }, props, { children: _jsx(View, { className: cn("pb-4 pt-0", className), children: children }) })));
});
export { Accordion, AccordionItemWithContext as AccordionItem, AccordionTrigger, AccordionContent };
//# sourceMappingURL=accordion.js.map