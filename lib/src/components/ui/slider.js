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
import { cn } from "@/lib/utils";
const Slider = React.forwardRef((_a, ref) => {
    var _b;
    var { className, trackClassName, rangeClassName, thumbClassName, value: valueProp, defaultValue, min = 0, max = 100, step = 1, onValueChange, disabled, orientation = "horizontal" } = _a, props = __rest(_a, ["className", "trackClassName", "rangeClassName", "thumbClassName", "value", "defaultValue", "min", "max", "step", "onValueChange", "disabled", "orientation"]);
    const [localValue, setLocalValue] = React.useState(valueProp || defaultValue || [min]);
    const [isDragging, setIsDragging] = React.useState(false);
    const [rect, setRect] = React.useState(null);
    const rectRef = React.useRef(null);
    const idRef = React.useRef(`slider-${Math.random().toString(36).substr(2, 9)}`);
    const value = valueProp !== undefined ? valueProp : localValue;
    const currentValue = (_b = value[0]) !== null && _b !== void 0 ? _b : min;
    React.useEffect(() => {
        rectRef.current = rect;
    }, [rect]);
    React.useEffect(() => {
        // Delay measurement to ensure the component is mounted and layout is ready
        const timer = setTimeout(() => {
            const query = Taro.createSelectorQuery();
            query
                .select(`#${idRef.current}`)
                .boundingClientRect((res) => {
                const measuredRect = Array.isArray(res) ? res[0] : res;
                if (measuredRect) {
                    setRect({ left: measuredRect.left, top: measuredRect.top, width: measuredRect.width, height: measuredRect.height });
                    rectRef.current = { left: measuredRect.left, top: measuredRect.top, width: measuredRect.width, height: measuredRect.height };
                }
            })
                .exec();
        }, 100);
        return () => clearTimeout(timer);
    }, []);
    const updateValue = (pageX, pageY, passedRect) => {
        const currentRect = passedRect || rectRef.current;
        if (!currentRect || disabled)
            return;
        let percentage = 0;
        if (orientation === "horizontal") {
            const { left, width } = currentRect;
            percentage = Math.min(Math.max((pageX - left) / width, 0), 1);
        }
        else {
            const { top, height } = currentRect;
            percentage = Math.min(Math.max(1 - (pageY - top) / height, 0), 1);
        }
        const rawValue = min + percentage * (max - min);
        const steppedValue = Math.round((rawValue - min) / step) * step + min;
        const newValue = Math.min(Math.max(steppedValue, min), max);
        if (newValue !== currentValue) {
            const nextValue = [newValue];
            if (valueProp === undefined) {
                setLocalValue(nextValue);
            }
            onValueChange === null || onValueChange === void 0 ? void 0 : onValueChange(nextValue);
        }
    };
    const handleTouchStart = (e) => {
        if (disabled)
            return;
        setIsDragging(true);
        // Try to update rect on touch start in case of layout changes
        const query = Taro.createSelectorQuery();
        query
            .select(`#${idRef.current}`)
            .boundingClientRect((res) => {
            const measuredRect = Array.isArray(res) ? res[0] : res;
            if (measuredRect) {
                setRect({ left: measuredRect.left, top: measuredRect.top, width: measuredRect.width, height: measuredRect.height });
                rectRef.current = { left: measuredRect.left, top: measuredRect.top, width: measuredRect.width, height: measuredRect.height };
                // If we have a touch event, update value immediately after getting fresh rect
                const touch = e.touches[0] || e.changedTouches[0];
                if (touch) {
                    updateValue(touch.pageX, touch.pageY, rectRef.current);
                }
            }
        })
            .exec();
    };
    const handleMouseDown = (e) => {
        if (disabled)
            return;
        setIsDragging(true);
        const query = Taro.createSelectorQuery();
        query
            .select(`#${idRef.current}`)
            .boundingClientRect((res) => {
            const measuredRect = Array.isArray(res) ? res[0] : res;
            if (measuredRect) {
                setRect({ left: measuredRect.left, top: measuredRect.top, width: measuredRect.width, height: measuredRect.height });
                rectRef.current = { left: measuredRect.left, top: measuredRect.top, width: measuredRect.width, height: measuredRect.height };
                updateValue(e.pageX, e.pageY, rectRef.current);
            }
        })
            .exec();
        const onMouseMove = (moveEvent) => {
            updateValue(moveEvent.pageX, moveEvent.pageY);
        };
        const onMouseUp = (upEvent) => {
            setIsDragging(false);
            updateValue(upEvent.pageX, upEvent.pageY);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        if (typeof document !== 'undefined') {
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    };
    const handleTouchMove = (e) => {
        if (disabled)
            return;
        const touch = e.touches[0] || e.changedTouches[0];
        if (touch) {
            updateValue(touch.pageX, touch.pageY);
        }
    };
    const handleTouchEnd = (e) => {
        if (disabled)
            return;
        setIsDragging(false);
        const touch = e.touches[0] || e.changedTouches[0];
        if (touch) {
            updateValue(touch.pageX, touch.pageY);
        }
    };
    const percentage = ((currentValue - min) / (max - min)) * 100;
    return (_jsxs(View, Object.assign({ ref: ref, id: idRef.current, className: cn("relative flex touch-none select-none items-center", orientation === "horizontal" ? "w-full py-4" : "h-full flex-col px-4", className), onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd, 
        // @ts-ignore
        onMouseDown: handleMouseDown }, props, { children: [_jsx(View, { className: cn("relative grow overflow-hidden rounded-full bg-secondary", orientation === "horizontal" ? "h-1 w-full" : "w-1 h-full", trackClassName), children: _jsx(View, { className: cn("absolute bg-primary", orientation === "horizontal" ? "h-full" : "w-full bottom-0", rangeClassName), style: orientation === "horizontal" ? { width: `${percentage}%` } : { height: `${percentage}%` } }) }), _jsx(View, { className: cn("absolute block h-3 w-3 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors disabled:pointer-events-none disabled:opacity-50", isDragging && "ring-4 ring-primary ring-opacity-30", disabled && "opacity-50", thumbClassName), style: orientation === "horizontal"
                    ? { left: `${percentage}%`, transform: 'translateX(-50%)' }
                    : { bottom: `${percentage}%`, transform: 'translateY(50%)' } })] })));
});
Slider.displayName = "Slider";
export { Slider };
//# sourceMappingURL=slider.js.map