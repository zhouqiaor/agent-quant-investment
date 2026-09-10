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
import { View, Input, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Search } from "lucide-react-taro";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
const CommandContext = React.createContext(null);
const CommandItemsContext = React.createContext(null);
const GroupContext = React.createContext(null);
function getNodeText(node) {
    var _a;
    if (node == null || typeof node === "boolean")
        return "";
    if (typeof node === "string" || typeof node === "number")
        return String(node);
    if (Array.isArray(node))
        return node.map(getNodeText).join(" ");
    if (React.isValidElement(node))
        return getNodeText((_a = node.props) === null || _a === void 0 ? void 0 : _a.children);
    return "";
}
const Command = React.forwardRef((_a, ref) => {
    var { className, children } = _a, props = __rest(_a, ["className", "children"]);
    const [search, setSearch] = React.useState("");
    // 使用 deferredSearch 来延迟搜索过滤逻辑，确保输入框在输入时保持响应，解决微信小程序中的输入抖动和文字消失问题
    const deferredSearch = React.useDeferredValue(search);
    const [, setItemsTick] = React.useState(0);
    const itemsRef = React.useRef(new Map());
    const tickRef = React.useRef(null);
    React.useEffect(() => {
        return () => {
            if (tickRef.current)
                clearTimeout(tickRef.current);
        };
    }, []);
    const triggerItemsUpdate = React.useCallback(() => {
        if (tickRef.current)
            return;
        // 使用短延时批处理项目状态更新，减少重绘频率
        tickRef.current = setTimeout(() => {
            setItemsTick((v) => v + 1);
            tickRef.current = null;
        }, 16);
    }, []);
    const setItemState = React.useCallback((id, state) => {
        const prev = itemsRef.current.get(id);
        if ((prev === null || prev === void 0 ? void 0 : prev.match) === state.match && (prev === null || prev === void 0 ? void 0 : prev.groupId) === state.groupId)
            return;
        itemsRef.current.set(id, state);
        triggerItemsUpdate();
    }, [triggerItemsUpdate]);
    const removeItem = React.useCallback((id) => {
        if (!itemsRef.current.has(id))
            return;
        itemsRef.current.delete(id);
        triggerItemsUpdate();
    }, [triggerItemsUpdate]);
    const hasAnyMatch = React.useCallback(() => {
        for (const s of itemsRef.current.values()) {
            if (s.match)
                return true;
        }
        return false;
    }, []);
    const groupHasAnyMatch = React.useCallback((groupId) => {
        for (const s of itemsRef.current.values()) {
            if (s.groupId === groupId && s.match)
                return true;
        }
        return false;
    }, []);
    const searchContextValue = React.useMemo(() => ({
        search,
        deferredSearch,
        setSearch,
    }), [search, deferredSearch]);
    const itemsContextValue = React.useMemo(() => ({
        setItemState,
        removeItem,
        hasAnyMatch,
        groupHasAnyMatch,
        itemsSize: itemsRef.current.size,
    }), [setItemState, removeItem, hasAnyMatch, groupHasAnyMatch]);
    return (_jsx(CommandContext.Provider, { value: searchContextValue, children: _jsx(CommandItemsContext.Provider, { value: itemsContextValue, children: _jsx(View, Object.assign({ ref: ref, className: cn("flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground", className) }, props, { children: children })) }) }));
});
Command.displayName = "Command";
const CommandDialog = (_a) => {
    var { children } = _a, props = __rest(_a, ["children"]);
    const _b = props, { open: openProp, defaultOpen, onOpenChange } = _b, rest = __rest(_b, ["open", "defaultOpen", "onOpenChange"]);
    const [openState, setOpenState] = React.useState(defaultOpen || false);
    const open = openProp !== undefined ? openProp : openState;
    const handleOpenChange = (newOpen) => {
        if (openProp === undefined)
            setOpenState(newOpen);
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(newOpen);
    };
    const enhancedChildren = React.useMemo(() => {
        const enhance = (node) => React.Children.map(node, (child) => {
            var _a, _b, _c;
            if (!React.isValidElement(child))
                return child;
            if (child.type === CommandInput) {
                if (((_a = child.props) === null || _a === void 0 ? void 0 : _a.focus) === false)
                    return child;
                return React.cloneElement(child, {
                    focus: open,
                    className: cn((_b = child.props) === null || _b === void 0 ? void 0 : _b.className, "pr-11")
                });
            }
            if (!((_c = child.props) === null || _c === void 0 ? void 0 : _c.children))
                return child;
            return React.cloneElement(child, undefined, enhance(child.props.children));
        });
        return enhance(children);
    }, [children, open]);
    return (_jsx(Dialog, Object.assign({ open: open, onOpenChange: handleOpenChange }, rest, { children: _jsx(DialogContent, { className: "overflow-hidden p-0 shadow-lg", closeClassName: "top-3", children: _jsx(Command, { children: enhancedChildren }) }) })));
};
const CommandInput = React.forwardRef((_a, ref) => {
    var _b, _c;
    var { className, placeholderClass, focus = true } = _a, props = __rest(_a, ["className", "placeholderClass", "focus"]);
    const context = React.useContext(CommandContext);
    const [localValue, setLocalValue] = React.useState((_b = context === null || context === void 0 ? void 0 : context.search) !== null && _b !== void 0 ? _b : "");
    const lastSyncedSearchRef = React.useRef((_c = context === null || context === void 0 ? void 0 : context.search) !== null && _c !== void 0 ? _c : "");
    const [inputFocus, setInputFocus] = React.useState(false);
    const focusTimerRef = React.useRef(null);
    React.useEffect(() => {
        var _a, _b;
        // 只有当 context.search 与上次同步的值不同，且与当前输入值也不同时，才进行强制同步（通常是外部重置了搜索内容）
        if ((context === null || context === void 0 ? void 0 : context.search) !== lastSyncedSearchRef.current && (context === null || context === void 0 ? void 0 : context.search) !== localValue) {
            setLocalValue((_a = context === null || context === void 0 ? void 0 : context.search) !== null && _a !== void 0 ? _a : "");
            lastSyncedSearchRef.current = (_b = context === null || context === void 0 ? void 0 : context.search) !== null && _b !== void 0 ? _b : "";
        }
    }, [context === null || context === void 0 ? void 0 : context.search, localValue]);
    React.useEffect(() => {
        if (focusTimerRef.current)
            clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
        if (!focus) {
            setInputFocus(false);
            return;
        }
        setInputFocus(false);
        const schedule = () => {
            focusTimerRef.current = setTimeout(() => {
                setInputFocus(true);
                focusTimerRef.current = null;
            }, 0);
        };
        if (typeof (Taro === null || Taro === void 0 ? void 0 : Taro.nextTick) === "function") {
            ;
            Taro.nextTick(schedule);
        }
        else {
            schedule();
        }
        return () => {
            if (focusTimerRef.current)
                clearTimeout(focusTimerRef.current);
            focusTimerRef.current = null;
        };
    }, [focus]);
    return (_jsxs(View, { className: "flex h-11 items-center border-b px-3", "data-slot": "command-input-wrapper", children: [_jsx(Search, { className: "mr-2 shrink-0 opacity-50", size: 16, color: "inherit" }), _jsx(Input, Object.assign({ ref: ref, className: cn("min-w-0 flex-1 rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50", className), placeholderClass: cn("text-muted-foreground", placeholderClass), value: localValue, onInput: (e) => {
                    const v = e.detail.value;
                    setLocalValue(v);
                    lastSyncedSearchRef.current = v;
                    context === null || context === void 0 ? void 0 : context.setSearch(v);
                }, focus: inputFocus }, props))] }));
});
CommandInput.displayName = "CommandInput";
const CommandList = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(ScrollView, Object.assign({ scrollY: true, ref: ref, className: cn("overflow-y-auto overflow-x-hidden", className) }, props)));
});
CommandList.displayName = "CommandList";
const CommandEmpty = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    const context = React.useContext(CommandItemsContext);
    const show = context ? context.itemsSize > 0 && !context.hasAnyMatch() : false;
    if (!show)
        return null;
    return (_jsx(View, Object.assign({ ref: ref, className: cn("py-6 text-center text-sm", className) }, props)));
});
CommandEmpty.displayName = "CommandEmpty";
const CommandGroup = React.forwardRef((_a, ref) => {
    var { className, heading, children } = _a, props = __rest(_a, ["className", "heading", "children"]);
    const context = React.useContext(CommandItemsContext);
    const groupId = React.useId();
    const show = !context || context.itemsSize === 0 || context.groupHasAnyMatch(groupId);
    return (_jsx(GroupContext.Provider, { value: { groupId }, children: _jsxs(View, Object.assign({ ref: ref, "data-slot": "command-group", className: cn("overflow-hidden p-1 text-foreground", className), style: !show ? { display: "none" } : undefined }, props, { children: [heading && (_jsx(View, { "data-slot": "command-group-heading", className: "px-2 py-2 text-xs font-medium text-muted-foreground", children: heading })), children] })) }));
});
CommandGroup.displayName = "CommandGroup";
const CommandSeparator = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ ref: ref, className: cn("-mx-1 h-px bg-border", className) }, props)));
});
CommandSeparator.displayName = "CommandSeparator";
const CommandItem = React.forwardRef((_a, ref) => {
    var _b;
    var { className, value, onSelect, disabled, children } = _a, props = __rest(_a, ["className", "value", "onSelect", "disabled", "children"]);
    const context = React.useContext(CommandContext);
    const itemsContext = React.useContext(CommandItemsContext);
    const group = React.useContext(GroupContext);
    const id = React.useId();
    const computedValue = React.useMemo(() => (value !== null && value !== void 0 ? value : getNodeText(children)).trim(), [value, children]);
    const search = ((_b = context === null || context === void 0 ? void 0 : context.deferredSearch) !== null && _b !== void 0 ? _b : "").trim().toLowerCase();
    const match = React.useMemo(() => !search || (!!computedValue && computedValue.toLowerCase().includes(search)), [search, computedValue]);
    React.useEffect(() => {
        if (!itemsContext)
            return;
        itemsContext.setItemState(id, { match, groupId: group === null || group === void 0 ? void 0 : group.groupId });
        return () => itemsContext.removeItem(id);
    }, [itemsContext, id, match, group === null || group === void 0 ? void 0 : group.groupId]);
    return (_jsx(View, Object.assign({ ref: ref, "data-slot": "command-item", className: cn("relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-2 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", disabled && "opacity-50 pointer-events-none", className), style: !match ? { display: "none" } : undefined, onClick: () => !disabled && (onSelect === null || onSelect === void 0 ? void 0 : onSelect(computedValue)) }, props, { children: children })));
});
CommandItem.displayName = "CommandItem";
const CommandShortcut = (_a) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (_jsx(View, Object.assign({ className: cn("ml-auto text-xs tracking-widest text-muted-foreground", className) }, props)));
};
CommandShortcut.displayName = "CommandShortcut";
export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator, };
//# sourceMappingURL=command.js.map