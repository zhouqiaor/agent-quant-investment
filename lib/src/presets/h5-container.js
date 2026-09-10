import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IS_H5_ENV } from './env';
import { H5NavBar } from './h5-navbar';
export const H5Container = ({ children }) => {
    if (!IS_H5_ENV) {
        return _jsx(_Fragment, { children: children });
    }
    return (_jsxs(_Fragment, { children: [_jsx(H5NavBar, {}), children] }));
};
//# sourceMappingURL=h5-container.js.map