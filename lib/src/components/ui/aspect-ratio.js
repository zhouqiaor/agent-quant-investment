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
import { View } from "@tarojs/components";
const AspectRatio = React.forwardRef((_a, ref) => {
    var { className, ratio = 1 / 1, style } = _a, props = __rest(_a, ["className", "ratio", "style"]);
    return (_jsx(View, Object.assign({ ref: ref, style: Object.assign({ position: 'relative', width: '100%', paddingBottom: `${100 / ratio}%` }, style), className: className }, props, { children: _jsx(View, { style: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
            }, children: props.children }) })));
});
AspectRatio.displayName = "AspectRatio";
export { AspectRatio };
//# sourceMappingURL=aspect-ratio.js.map