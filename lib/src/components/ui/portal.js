import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import * as TaroComponents from "@tarojs/components";
import { createPortal } from "react-dom";
import { isH5 } from "@/lib/platform";
const RootPortal = TaroComponents.RootPortal;
const Portal = ({ children }) => {
    if (isH5()) {
        if (typeof document === "undefined")
            return _jsx(_Fragment, { children: children });
        return createPortal(children, document.body);
    }
    if (!RootPortal) {
        return _jsx(_Fragment, { children: children });
    }
    return _jsx(RootPortal, { children: children });
};
export { Portal };
//# sourceMappingURL=portal.js.map