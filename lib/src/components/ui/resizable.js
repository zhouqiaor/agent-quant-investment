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
import Taro from "@tarojs/taro";
import { GripVertical } from "lucide-react-taro";
import { cn } from "@/lib/utils";
import { isH5 } from "@/lib/platform";
function getPoint(e) {
    var _a, _b;
    const touch = ((_a = e === null || e === void 0 ? void 0 : e.touches) === null || _a === void 0 ? void 0 : _a[0]) || ((_b = e === null || e === void 0 ? void 0 : e.changedTouches) === null || _b === void 0 ? void 0 : _b[0]);
    return touch || e;
}
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const ResizablePanelGroup = (_a) => {
    var { className, children, direction = "horizontal" } = _a, props = __rest(_a, ["className", "children", "direction"]);
    const idRef = React.useRef(`resizable-${Math.random().toString(36).slice(2, 11)}`);
    const groupRef = React.useRef(null);
    const sizesRef = React.useRef(null);
    const [sizes, setSizes] = React.useState(null);
    const rectSizeRef = React.useRef(null);
    const dragRef = React.useRef(null);
    React.useEffect(() => {
        sizesRef.current = sizes;
    }, [sizes]);
    const isPanelElement = React.useCallback((child) => {
        var _a;
        return ((_a = child === null || child === void 0 ? void 0 : child.type) === null || _a === void 0 ? void 0 : _a.displayName) === "ResizablePanel";
    }, []);
    const isHandleElement = React.useCallback((child) => {
        var _a;
        return ((_a = child === null || child === void 0 ? void 0 : child.type) === null || _a === void 0 ? void 0 : _a.displayName) === "ResizableHandle";
    }, []);
    const panels = React.useMemo(() => {
        const out = [];
        React.Children.forEach(children, (child) => {
            if (!React.isValidElement(child))
                return;
            if (isPanelElement(child))
                out.push(child);
        });
        return out;
    }, [children, isPanelElement]);
    const measure = React.useCallback(() => {
        const el = groupRef.current;
        if (isH5() && typeof (el === null || el === void 0 ? void 0 : el.getBoundingClientRect) === "function") {
            const rect = el.getBoundingClientRect();
            const width = rect === null || rect === void 0 ? void 0 : rect.width;
            const height = rect === null || rect === void 0 ? void 0 : rect.height;
            if (typeof width === "number" && typeof height === "number") {
                rectSizeRef.current = { width, height };
                return Promise.resolve(rectSizeRef.current);
            }
        }
        return new Promise((resolve) => {
            const query = Taro.createSelectorQuery();
            query
                .select(`#${idRef.current}`)
                .boundingClientRect((res) => {
                const r = Array.isArray(res) ? res[0] : res;
                const width = r === null || r === void 0 ? void 0 : r.width;
                const height = r === null || r === void 0 ? void 0 : r.height;
                if (typeof width === "number" && typeof height === "number") {
                    rectSizeRef.current = { width, height };
                    resolve(rectSizeRef.current);
                    return;
                }
                resolve(null);
            })
                .exec();
        });
    }, []);
    React.useEffect(() => {
        const defaults = panels.map((p) => {
            var _a;
            const v = (_a = p.props) === null || _a === void 0 ? void 0 : _a.defaultSize;
            return typeof v === "number" && Number.isFinite(v) ? v : null;
        });
        const hasAnyDefault = defaults.some((v) => v != null);
        const next = hasAnyDefault
            ? defaults.map((v) => (v == null ? 0 : v))
            : panels.map(() => 100 / Math.max(1, panels.length));
        const total = next.reduce((a, b) => a + b, 0) || 1;
        const normalized = next.map((v) => (v / total) * 100);
        setSizes((prev) => {
            if (prev && prev.length === normalized.length)
                return prev;
            return normalized;
        });
    }, [panels]);
    React.useEffect(() => {
        void measure();
        if (!isH5() || typeof window === "undefined")
            return;
        const onResize = () => void measure();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [measure]);
    const applyMove = React.useCallback((e) => {
        const drag = dragRef.current;
        const currentSizes = sizesRef.current;
        if (!drag || !currentSizes)
            return;
        const p = getPoint(e);
        const pos = drag.axis === "x" ? p === null || p === void 0 ? void 0 : p.pageX : p === null || p === void 0 ? void 0 : p.pageY;
        if (typeof pos !== "number")
            return;
        if (!drag.containerSize)
            return;
        const deltaPercent = ((pos - drag.startPos) / drag.containerSize) * 100;
        const left = drag.leftIndex;
        const right = left + 1;
        const total = drag.startSizes[left] + drag.startSizes[right];
        const min = 10;
        const nextLeft = clamp(drag.startSizes[left] + deltaPercent, min, total - min);
        const next = drag.startSizes.slice();
        next[left] = nextLeft;
        next[right] = total - nextLeft;
        setSizes(next);
    }, []);
    const endDrag = React.useCallback(() => {
        dragRef.current = null;
        if (!isH5() || typeof document === "undefined")
            return;
        document.removeEventListener("mousemove", onDocumentMouseMove);
        document.removeEventListener("mouseup", onDocumentMouseUp);
        document.removeEventListener("touchmove", onDocumentTouchMove, { passive: false });
        document.removeEventListener("touchend", onDocumentTouchEnd);
        document.removeEventListener("touchcancel", onDocumentTouchEnd);
    }, []);
    const onDocumentMouseMove = React.useCallback((e) => applyMove(e), [applyMove]);
    const onDocumentMouseUp = React.useCallback(() => endDrag(), [endDrag]);
    const onDocumentTouchMove = React.useCallback((e) => {
        var _a;
        const drag = dragRef.current;
        if (!drag || drag.input !== "touch")
            return;
        (_a = e === null || e === void 0 ? void 0 : e.preventDefault) === null || _a === void 0 ? void 0 : _a.call(e);
        applyMove(e);
    }, [applyMove]);
    const onDocumentTouchEnd = React.useCallback(() => endDrag(), [endDrag]);
    React.useEffect(() => {
        return () => endDrag();
    }, [endDrag]);
    const startDrag = React.useCallback(async (leftIndex, e) => {
        var _a, _b;
        const currentSizes = sizesRef.current;
        if (!currentSizes)
            return;
        if (leftIndex < 0 || leftIndex >= currentSizes.length - 1)
            return;
        const axis = direction === "horizontal" ? "x" : "y";
        const p = getPoint(e);
        const pos = axis === "x" ? p === null || p === void 0 ? void 0 : p.pageX : p === null || p === void 0 ? void 0 : p.pageY;
        if (typeof pos !== "number")
            return;
        const input = ((_a = e === null || e === void 0 ? void 0 : e.touches) === null || _a === void 0 ? void 0 : _a.length) ? "touch" : "mouse";
        const rect = rectSizeRef.current || (await measure());
        const containerSize = axis === "x" ? rect === null || rect === void 0 ? void 0 : rect.width : rect === null || rect === void 0 ? void 0 : rect.height;
        if (!containerSize)
            return;
        dragRef.current = {
            axis,
            input,
            leftIndex,
            startPos: pos,
            startSizes: currentSizes.slice(),
            containerSize,
        };
        (_b = e === null || e === void 0 ? void 0 : e.preventDefault) === null || _b === void 0 ? void 0 : _b.call(e);
        if (isH5() && typeof document !== "undefined") {
            if (input === "mouse") {
                document.addEventListener("mousemove", onDocumentMouseMove);
                document.addEventListener("mouseup", onDocumentMouseUp);
            }
            else {
                document.addEventListener("touchmove", onDocumentTouchMove, { passive: false });
                document.addEventListener("touchend", onDocumentTouchEnd);
                document.addEventListener("touchcancel", onDocumentTouchEnd);
            }
        }
    }, [
        direction,
        measure,
        onDocumentMouseMove,
        onDocumentMouseUp,
        onDocumentTouchEnd,
        onDocumentTouchMove,
    ]);
    const onGroupTouchMove = React.useCallback((e) => {
        var _a;
        const drag = dragRef.current;
        if (!drag || drag.input !== "touch")
            return;
        (_a = e === null || e === void 0 ? void 0 : e.preventDefault) === null || _a === void 0 ? void 0 : _a.call(e);
        applyMove(e);
    }, [applyMove]);
    const onGroupTouchEnd = React.useCallback(() => endDrag(), [endDrag]);
    let panelIndex = 0;
    let handleIndex = 0;
    return (_jsx(View, Object.assign({ id: idRef.current, ref: groupRef, className: cn("flex h-full w-full items-stretch overflow-hidden", direction === "vertical" ? "flex-col" : "flex-row", className) }, props, { onTouchMove: onGroupTouchMove, onTouchEnd: onGroupTouchEnd, onTouchCancel: onGroupTouchEnd, children: React.Children.map(children, (child) => {
            var _a;
            if (!React.isValidElement(child))
                return child;
            if (isPanelElement(child)) {
                const size = sizes === null || sizes === void 0 ? void 0 : sizes[panelIndex];
                const cloned = React.cloneElement(child, {
                    __size: typeof size === "number" ? size : undefined,
                    __direction: direction,
                });
                panelIndex += 1;
                return cloned;
            }
            if (isHandleElement(child)) {
                const leftIndex = panelIndex - 1;
                const cursorClass = direction === "horizontal" ? "cursor-col-resize" : "cursor-row-resize";
                const cloned = React.cloneElement(child, {
                    __direction: direction,
                    className: cn(cursorClass, (_a = child.props) === null || _a === void 0 ? void 0 : _a.className),
                    onTouchStart: (e) => void startDrag(leftIndex, e),
                    // @ts-ignore
                    onMouseDown: (e) => void startDrag(leftIndex, e),
                    "data-handle-index": handleIndex,
                });
                handleIndex += 1;
                return cloned;
            }
            return child;
        }) })));
};
const ResizablePanel = (_a) => {
    var _b;
    var { className, children, defaultSize, __size, __direction } = _a, props = __rest(_a, ["className", "children", "defaultSize", "__size", "__direction"]);
    return (_jsx(View, Object.assign({}, props, { className: cn("flex min-h-0 min-w-0 flex-col overflow-hidden", className), style: Object.assign({ flexBasis: 0, flexGrow: (_b = __size !== null && __size !== void 0 ? __size : defaultSize) !== null && _b !== void 0 ? _b : 1, flexShrink: 1, minWidth: 0, minHeight: 0 }, props === null || props === void 0 ? void 0 : props.style), children: children })));
};
const ResizableHandle = (_a) => {
    var { withHandle, className, __direction } = _a, props = __rest(_a, ["withHandle", "className", "__direction"]);
    return (_jsxs(View, Object.assign({}, props, { className: cn("relative flex shrink-0 items-center justify-center bg-transparent", __direction === "vertical" ? "h-3 self-stretch" : "w-3 self-stretch", className), children: [_jsx(View, { className: cn("absolute bg-border", __direction === "vertical"
                    ? "inset-x-0 top-1/2 -translate-y-1/2"
                    : "inset-y-0 left-1/2 -translate-x-1/2"), style: __direction === "vertical" ? { height: "1PX" } : { width: "1PX" } }), withHandle && (_jsx(View, { className: "z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border", children: _jsx(GripVertical, { className: "h-3 w-3", size: 12, color: "inherit" }) }))] })));
};
ResizablePanel.displayName = "ResizablePanel";
ResizableHandle.displayName = "ResizableHandle";
export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
//# sourceMappingURL=resizable.js.map