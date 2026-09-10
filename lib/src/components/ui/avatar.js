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
import { View, Image } from "@tarojs/components";
import { cn } from "@/lib/utils";
const AvatarContext = React.createContext(null);
const Avatar = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    const [status, setStatus] = React.useState("loading");
    return (_jsx(AvatarContext.Provider, { value: { status, setStatus }, children: _jsx(View, Object.assign({ ref: ref, className: cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className) }, props)) }));
});
Avatar.displayName = "Avatar";
const AvatarImage = React.forwardRef((_a, ref) => {
    var { className, src } = _a, props = __rest(_a, ["className", "src"]);
    const context = React.useContext(AvatarContext);
    const handleLoad = (e) => {
        var _a;
        context === null || context === void 0 ? void 0 : context.setStatus("loaded");
        (_a = props.onLoad) === null || _a === void 0 ? void 0 : _a.call(props, e);
    };
    const handleError = (e) => {
        var _a;
        context === null || context === void 0 ? void 0 : context.setStatus("error");
        (_a = props.onError) === null || _a === void 0 ? void 0 : _a.call(props, e);
    };
    return (_jsx(Image, Object.assign({ ref: ref, src: src, className: cn("aspect-square h-full w-full", className, (context === null || context === void 0 ? void 0 : context.status) !== "loaded" && "w-0 h-0 opacity-0 absolute"), onLoad: handleLoad, onError: handleError }, props)));
});
AvatarImage.displayName = "AvatarImage";
const AvatarFallback = React.forwardRef((_a, ref) => {
    var { className } = _a, props = __rest(_a, ["className"]);
    const context = React.useContext(AvatarContext);
    if ((context === null || context === void 0 ? void 0 : context.status) === "loaded")
        return null;
    return (_jsx(View, Object.assign({ ref: ref, className: cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className) }, props)));
});
AvatarFallback.displayName = "AvatarFallback";
export { Avatar, AvatarImage, AvatarFallback };
//# sourceMappingURL=avatar.js.map