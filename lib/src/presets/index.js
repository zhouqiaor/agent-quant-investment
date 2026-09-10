import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useLaunch } from '@tarojs/taro';
import { injectH5Styles } from './h5-styles';
import { devDebug } from './dev-debug';
import { H5Container } from './h5-container';
import { H5ErrorBoundary, initializeH5ErrorHandling, } from './h5-error-boundary';
import { IS_H5_ENV } from './env';
export const Preset = ({ children }) => {
    if (IS_H5_ENV) {
        initializeH5ErrorHandling();
    }
    useLaunch(() => {
        devDebug();
        injectH5Styles();
    });
    if (IS_H5_ENV) {
        return (_jsx(H5ErrorBoundary, { children: _jsx(H5Container, { children: children }) }));
    }
    return _jsx(_Fragment, { children: children });
};
//# sourceMappingURL=index.js.map