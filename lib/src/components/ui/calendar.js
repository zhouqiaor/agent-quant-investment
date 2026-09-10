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
import { Picker, Text, View } from "@tarojs/components";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-taro";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isAfter, isBefore, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths, } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
function isDateDisabled(date, disabled) {
    if (!disabled)
        return false;
    if (Array.isArray(disabled))
        return disabled.some((d) => isSameDay(d, date));
    return disabled(date);
}
function isInRange(date, range) {
    if (!(range === null || range === void 0 ? void 0 : range.from) || !(range === null || range === void 0 ? void 0 : range.to))
        return false;
    return ((isAfter(date, range.from) || isSameDay(date, range.from)) &&
        (isBefore(date, range.to) || isSameDay(date, range.to)));
}
function getSingleSelected(props) {
    return props.mode === "range" ? undefined : props.selected;
}
function getRangeSelected(props) {
    return props.mode === "range" ? props.selected : undefined;
}
function Calendar(_a) {
    var { className, month, defaultMonth, onMonthChange, showOutsideDays = true, weekStartsOn = 0, disabled, captionLayout = "dropdown", fromYear, toYear } = _a, props = __rest(_a, ["className", "month", "defaultMonth", "onMonthChange", "showOutsideDays", "weekStartsOn", "disabled", "captionLayout", "fromYear", "toYear"]);
    const singleSelected = getSingleSelected(Object.assign({ month, defaultMonth, onMonthChange, showOutsideDays, weekStartsOn, disabled, className }, props));
    const rangeSelected = getRangeSelected(Object.assign({ month, defaultMonth, onMonthChange, showOutsideDays, weekStartsOn, disabled, className }, props));
    const initialMonth = React.useMemo(() => {
        if (month)
            return month;
        if (defaultMonth)
            return defaultMonth;
        if (singleSelected)
            return singleSelected;
        if (rangeSelected === null || rangeSelected === void 0 ? void 0 : rangeSelected.from)
            return rangeSelected.from;
        return new Date();
    }, [defaultMonth, month, rangeSelected === null || rangeSelected === void 0 ? void 0 : rangeSelected.from, singleSelected]);
    const [uncontrolledMonth, setUncontrolledMonth] = React.useState(initialMonth);
    const visibleMonth = month !== null && month !== void 0 ? month : uncontrolledMonth;
    const setMonth = React.useCallback((next) => {
        if (!month)
            setUncontrolledMonth(next);
        onMonthChange === null || onMonthChange === void 0 ? void 0 : onMonthChange(next);
    }, [month, onMonthChange]);
    const captionHasDropdown = captionLayout === "dropdown";
    const captionHasButtons = true;
    const yearOptions = React.useMemo(() => {
        const baseYear = new Date().getFullYear();
        const visibleYear = visibleMonth.getFullYear();
        const min = fromYear !== null && fromYear !== void 0 ? fromYear : baseYear - 100;
        const max = toYear !== null && toYear !== void 0 ? toYear : baseYear + 20;
        const start = Math.min(min, visibleYear);
        const end = Math.max(max, visibleYear);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }, [fromYear, toYear, visibleMonth]);
    const monthOptions = React.useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => i + 1);
    }, []);
    const yearIndex = React.useMemo(() => {
        const y = visibleMonth.getFullYear();
        const idx = yearOptions.indexOf(y);
        return idx >= 0 ? idx : 0;
    }, [visibleMonth, yearOptions]);
    const monthIndex = React.useMemo(() => {
        return visibleMonth.getMonth();
    }, [visibleMonth]);
    const setYear = React.useCallback((year) => {
        setMonth(new Date(year, visibleMonth.getMonth(), 1));
    }, [setMonth, visibleMonth]);
    const setMonthOfYear = React.useCallback((monthOfYear) => {
        setMonth(new Date(visibleMonth.getFullYear(), monthOfYear - 1, 1));
    }, [setMonth, visibleMonth]);
    const gridStart = React.useMemo(() => {
        return startOfWeek(startOfMonth(visibleMonth), { weekStartsOn });
    }, [visibleMonth, weekStartsOn]);
    const gridEnd = React.useMemo(() => {
        return endOfWeek(endOfMonth(visibleMonth), { weekStartsOn });
    }, [visibleMonth, weekStartsOn]);
    const weeks = React.useMemo(() => {
        const days = [];
        for (let d = gridStart; !isAfter(d, gridEnd); d = addDays(d, 1)) {
            days.push(d);
        }
        const rows = [];
        for (let i = 0; i < days.length; i += 7)
            rows.push(days.slice(i, i + 7));
        return rows;
    }, [gridEnd, gridStart]);
    const weekdays = React.useMemo(() => {
        const labels = ["日", "一", "二", "三", "四", "五", "六"];
        return Array.from({ length: 7 }).map((_, i) => labels[(i + weekStartsOn) % 7]);
    }, [weekStartsOn]);
    const handleSelect = React.useCallback((date) => {
        var _a, _b;
        if (isDateDisabled(date, disabled))
            return;
        if (props.mode === "range") {
            const current = props.selected;
            let next;
            if (!(current === null || current === void 0 ? void 0 : current.from) || (current.from && current.to)) {
                next = { from: date, to: undefined };
            }
            else if (current.from && !current.to) {
                if (isBefore(date, current.from)) {
                    next = { from: date, to: current.from };
                }
                else {
                    next = { from: current.from, to: date };
                }
            }
            else {
                next = { from: date, to: undefined };
            }
            (_a = props.onSelect) === null || _a === void 0 ? void 0 : _a.call(props, next);
            return;
        }
        (_b = props.onSelect) === null || _b === void 0 ? void 0 : _b.call(props, date);
    }, [disabled, props]);
    return (_jsxs(View, { className: cn("bg-background w-fit rounded-md p-3", "flex flex-col gap-3 border-2", className), children: [_jsxs(View, { className: "flex items-center justify-between", children: [captionHasButtons ? (_jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", onClick: () => setMonth(subMonths(visibleMonth, 1)), children: _jsx(ChevronLeft, { size: 16, color: "inherit" }) })) : (_jsx(View, { className: "h-8 w-8" })), captionHasDropdown ? (_jsxs(View, { className: "flex items-center gap-2", children: [_jsx(Picker, { mode: "selector", range: yearOptions, value: yearIndex, onChange: (e) => setYear(yearOptions[Number(e.detail.value)]), children: _jsxs(Button, { variant: "ghost", className: "h-8 px-2", children: [_jsx(Text, { className: "text-sm font-medium", children: visibleMonth.getFullYear() }), _jsx(ChevronDown, { size: 16, className: "opacity-50", color: "inherit" })] }) }), _jsx(Picker, { mode: "selector", range: monthOptions, value: monthIndex, onChange: (e) => setMonthOfYear(monthOptions[Number(e.detail.value)]), children: _jsxs(Button, { variant: "ghost", className: "h-8 px-2", children: [_jsxs(Text, { className: "text-sm font-medium", children: [String(visibleMonth.getMonth() + 1).padStart(2, "0"), "\u6708"] }), _jsx(ChevronDown, { size: 16, className: "opacity-50", color: "inherit" })] }) })] })) : (_jsx(Text, { className: "text-sm font-medium", children: format(visibleMonth, "yyyy年MM月") })), captionHasButtons ? (_jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", onClick: () => setMonth(addMonths(visibleMonth, 1)), children: _jsx(ChevronRight, { size: 16, color: "inherit" }) })) : (_jsx(View, { className: "h-8 w-8" }))] }), _jsx(View, { className: "flex", children: weekdays.map((label) => (_jsx(View, { className: "flex flex-1 items-center justify-center", children: _jsx(Text, { className: "text-muted-foreground text-xs font-normal", children: label }) }, label))) }), _jsx(View, { className: "flex flex-col gap-2", children: weeks.map((week, rowIndex) => (_jsx(View, { className: "flex", children: week.map((date) => {
                        const outside = !isSameMonth(date, visibleMonth);
                        const hidden = outside && !showOutsideDays;
                        const disabledDay = isDateDisabled(date, disabled);
                        const today = isSameDay(date, new Date());
                        const range = rangeSelected;
                        const selectedSingle = singleSelected
                            ? isSameDay(date, singleSelected)
                            : false;
                        const rangeStart = (range === null || range === void 0 ? void 0 : range.from) ? isSameDay(date, range.from) : false;
                        const rangeEnd = (range === null || range === void 0 ? void 0 : range.to) ? isSameDay(date, range.to) : false;
                        const rangeMiddle = !!(range === null || range === void 0 ? void 0 : range.from) && !!(range === null || range === void 0 ? void 0 : range.to) && isInRange(date, range) && !rangeStart && !rangeEnd;
                        return (_jsx(View, { className: cn("flex flex-1 items-center justify-center", hidden && "invisible"), children: _jsx(CalendarDayButton, { date: date, outside: outside, today: today, disabled: disabledDay, selectedSingle: selectedSingle, rangeStart: rangeStart, rangeMiddle: rangeMiddle, rangeEnd: rangeEnd, onPress: handleSelect }) }, date.toISOString()));
                    }) }, rowIndex))) })] }));
}
function CalendarDayButton({ date, outside, today, disabled, selectedSingle, rangeStart, rangeMiddle, rangeEnd, onPress, }) {
    const base = "h-8 w-8 p-0 flex items-center justify-center rounded-md";
    const outsideClass = outside ? "text-muted-foreground" : "";
    const todayClass = today ? "bg-accent text-accent-foreground" : "";
    const selectedSingleClass = selectedSingle
        ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
        : "";
    const rangeStartClass = rangeStart
        ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
        : "";
    const rangeEndClass = rangeEnd
        ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
        : "";
    const rangeMiddleClass = rangeMiddle
        ? "bg-accent text-accent-foreground rounded-none"
        : "";
    const rangeCapClass = rangeStart || rangeEnd ? "rounded-md" : "";
    return (_jsx(Button, { variant: "ghost", size: "icon", className: cn(base, outsideClass, todayClass, selectedSingleClass, rangeMiddleClass, rangeStartClass, rangeEndClass, rangeCapClass, disabled && "opacity-50 pointer-events-none"), onClick: disabled ? undefined : () => onPress(date), children: _jsx(Text, { className: "text-sm", children: format(date, "d") }) }));
}
export { Calendar, CalendarDayButton };
//# sourceMappingURL=calendar.js.map