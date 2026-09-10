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
import { View, Swiper, SwiperItem } from "@tarojs/components";
import { ArrowLeft, ArrowRight } from "lucide-react-taro";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
const CarouselContext = React.createContext(null);
function useCarousel() {
    const context = React.useContext(CarouselContext);
    if (!context) {
        throw new Error("useCarousel must be used within a <Carousel />");
    }
    return context;
}
const Carousel = React.forwardRef((_a, ref) => {
    var { opts, orientation = "horizontal", setApi, className, children } = _a, props = __rest(_a, ["opts", "orientation", "setApi", "className", "children"]);
    const [current, setCurrent] = React.useState(0);
    const [count, setCount] = React.useState(0);
    const scrollPrev = React.useCallback(() => {
        setCurrent((prev) => Math.max(0, prev - 1));
    }, []);
    const scrollNext = React.useCallback(() => {
        setCurrent((prev) => Math.min(count - 1, prev + 1));
    }, [count]);
    const canScrollPrev = current > 0;
    const canScrollNext = current < count - 1;
    const scrollTo = React.useCallback((index) => {
        setCurrent(index);
    }, []);
    const selectedScrollSnap = React.useCallback(() => current, [current]);
    React.useEffect(() => {
        if (setApi) {
            setApi({
                scrollPrev,
                scrollNext,
                canScrollPrev,
                canScrollNext,
                scrollTo,
                selectedScrollSnap,
            });
        }
    }, [setApi, scrollPrev, scrollNext, canScrollPrev, canScrollNext, scrollTo, selectedScrollSnap]);
    return (_jsx(CarouselContext.Provider, { value: {
            orientation,
            current,
            setCurrent,
            count,
            setCount,
            scrollPrev,
            scrollNext,
            canScrollPrev,
            canScrollNext,
            opts,
        }, children: _jsx(View, Object.assign({ ref: ref, className: cn("relative w-full", className) }, props, { children: children })) }));
});
Carousel.displayName = "Carousel";
const CarouselContent = React.forwardRef((_a, ref) => {
    var { className, children } = _a, props = __rest(_a, ["className", "children"]);
    const { orientation, current, setCurrent, setCount, opts } = useCarousel();
    React.useEffect(() => {
        const childCount = React.Children.count(children);
        setCount(childCount);
    }, [children, setCount]);
    return (_jsx(View, { className: cn("overflow-hidden", className), children: _jsx(Swiper, Object.assign({ ref: ref, className: "h-full w-full", vertical: orientation === "vertical", current: current, onChange: (e) => setCurrent(e.detail.current), circular: opts === null || opts === void 0 ? void 0 : opts.loop, autoplay: opts === null || opts === void 0 ? void 0 : opts.autoplay, interval: (opts === null || opts === void 0 ? void 0 : opts.interval) || 5000, duration: (opts === null || opts === void 0 ? void 0 : opts.duration) || 500, displayMultipleItems: (opts === null || opts === void 0 ? void 0 : opts.displayMultipleItems) || 1 }, props, { children: React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                    return _jsx(SwiperItem, { className: "h-full w-full", children: child });
                }
                return null;
            }) })) }));
});
CarouselContent.displayName = "CarouselContent";
const CarouselItem = (_a) => {
    var { className, children } = _a, props = __rest(_a, ["className", "children"]);
    return (_jsx(View, Object.assign({ className: cn("h-full w-full", className) }, props, { children: children })));
};
CarouselItem.displayName = "CarouselItem";
const CarouselPrevious = React.forwardRef((_a, ref) => {
    var { className, variant = "outline", size = "icon" } = _a, props = __rest(_a, ["className", "variant", "size"]);
    const { orientation, scrollPrev, canScrollPrev } = useCarousel();
    return (_jsxs(Button, Object.assign({ ref: ref, variant: variant, size: size, className: cn("absolute h-8 w-8 rounded-full z-10 bg-background bg-opacity-80 backdrop-blur-sm", orientation === "horizontal"
            ? "-left-12 top-0 bottom-0 my-auto"
            : "-top-12 left-0 right-0 mx-auto rotate-90", className), disabled: !canScrollPrev, onClick: scrollPrev }, props, { children: [_jsx(ArrowLeft, { size: 16, color: "inherit" }), _jsx(View, { className: "sr-only", children: "Previous slide" })] })));
});
CarouselPrevious.displayName = "CarouselPrevious";
const CarouselNext = React.forwardRef((_a, ref) => {
    var { className, variant = "outline", size = "icon" } = _a, props = __rest(_a, ["className", "variant", "size"]);
    const { orientation, scrollNext, canScrollNext } = useCarousel();
    return (_jsxs(Button, Object.assign({ ref: ref, variant: variant, size: size, className: cn("absolute h-8 w-8 rounded-full z-10 bg-background bg-opacity-80 backdrop-blur-sm", orientation === "horizontal"
            ? "-right-12 top-0 bottom-0 my-auto"
            : "-bottom-12 left-0 right-0 mx-auto rotate-90", className), disabled: !canScrollNext, onClick: scrollNext }, props, { children: [_jsx(ArrowRight, { size: 16, color: "inherit" }), _jsx(View, { className: "sr-only", children: "Next slide" })] })));
});
CarouselNext.displayName = "CarouselNext";
export { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, };
//# sourceMappingURL=carousel.js.map