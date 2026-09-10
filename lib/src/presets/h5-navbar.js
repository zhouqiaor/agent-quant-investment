import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePageScroll } from '@tarojs/taro';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, House } from 'lucide-react-taro';
import { IS_H5_ENV } from './env';
var LeftIcon;
(function (LeftIcon) {
    LeftIcon["Back"] = "back";
    LeftIcon["Home"] = "home";
    LeftIcon["None"] = "none";
})(LeftIcon || (LeftIcon = {}));
const DEFAULT_NAV_STATE = {
    visible: false,
    title: '',
    bgColor: '#ffffff',
    textStyle: 'black',
    navStyle: 'default',
    transparent: 'none',
    leftIcon: LeftIcon.None,
};
const getGlobalWindowConfig = () => {
    var _a;
    const app = Taro.getApp();
    return ((_a = app === null || app === void 0 ? void 0 : app.config) === null || _a === void 0 ? void 0 : _a.window) || {};
};
const getTabBarPages = () => {
    var _a, _b, _c;
    const tabBar = (_b = (_a = Taro.getApp()) === null || _a === void 0 ? void 0 : _a.config) === null || _b === void 0 ? void 0 : _b.tabBar;
    return new Set(((_c = tabBar === null || tabBar === void 0 ? void 0 : tabBar.list) === null || _c === void 0 ? void 0 : _c.map((item) => item.pagePath)) || []);
};
const getHomePage = () => {
    var _a, _b;
    const app = Taro.getApp();
    return ((_b = (_a = app === null || app === void 0 ? void 0 : app.config) === null || _a === void 0 ? void 0 : _a.pages) === null || _b === void 0 ? void 0 : _b[0]) || 'pages/index/index';
};
const cleanPath = (path) => path.replace(/^\//, '');
const computeLeftIcon = (route, tabBarPages, historyLength, homePage) => {
    if (!route)
        return LeftIcon.None;
    const cleanRoute = cleanPath(route);
    const cleanHomePage = cleanPath(homePage);
    const isHomePage = cleanRoute === cleanHomePage;
    const isTabBarPage = tabBarPages.has(cleanRoute) || tabBarPages.has(`/${cleanRoute}`);
    const hasHistory = historyLength > 1;
    if (isTabBarPage || isHomePage)
        return LeftIcon.None;
    if (hasHistory)
        return LeftIcon.Back;
    return LeftIcon.Home;
};
export const H5NavBar = () => {
    const [navState, setNavState] = useState(DEFAULT_NAV_STATE);
    const [scrollOpacity, setScrollOpacity] = useState(0);
    const updateNavState = useCallback(() => {
        const pages = Taro.getCurrentPages();
        if (pages.length === 0) {
            setNavState(prev => (Object.assign(Object.assign({}, prev), { visible: false })));
            return;
        }
        const currentPage = pages[pages.length - 1];
        const route = (currentPage === null || currentPage === void 0 ? void 0 : currentPage.route) || '';
        if (!route)
            return;
        const pageConfig = (currentPage === null || currentPage === void 0 ? void 0 : currentPage.config) || {};
        const globalConfig = getGlobalWindowConfig();
        const tabBarPages = getTabBarPages();
        const homePage = getHomePage();
        const cleanRoute = cleanPath(route);
        const cleanHomePage = cleanPath(homePage);
        const isHomePage = cleanRoute === cleanHomePage;
        const isTabBarPage = tabBarPages.has(cleanRoute) || tabBarPages.has(`/${cleanRoute}`);
        const shouldHideNav = tabBarPages.size <= 1 &&
            pages.length <= 1 &&
            (isHomePage || isTabBarPage);
        setNavState({
            visible: !shouldHideNav,
            title: document.title ||
                pageConfig.navigationBarTitleText ||
                globalConfig.navigationBarTitleText ||
                '',
            bgColor: pageConfig.navigationBarBackgroundColor ||
                globalConfig.navigationBarBackgroundColor ||
                '#ffffff',
            textStyle: pageConfig.navigationBarTextStyle ||
                globalConfig.navigationBarTextStyle ||
                'black',
            navStyle: pageConfig.navigationStyle || globalConfig.navigationStyle || 'default',
            transparent: pageConfig.transparentTitle || globalConfig.transparentTitle || 'none',
            leftIcon: shouldHideNav
                ? LeftIcon.None
                : computeLeftIcon(cleanRoute, tabBarPages, pages.length, cleanHomePage),
        });
    }, []);
    useDidShow(() => {
        updateNavState();
    });
    usePageScroll(({ scrollTop }) => {
        if (navState.transparent === 'auto') {
            setScrollOpacity(Math.min(scrollTop / 100, 1));
        }
    });
    useEffect(() => {
        if (!IS_H5_ENV)
            return;
        let timer = null;
        const observer = new MutationObserver(() => {
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(() => {
                updateNavState();
            }, 50);
        });
        observer.observe(document.head, {
            subtree: true,
            childList: true,
            characterData: true,
        });
        updateNavState();
        return () => {
            observer.disconnect();
            if (timer)
                clearTimeout(timer);
        };
    }, [updateNavState]);
    const shouldRender = IS_H5_ENV && navState.visible && navState.navStyle !== 'custom';
    useEffect(() => {
        if (!IS_H5_ENV)
            return;
        if (shouldRender) {
            document.body.classList.add('h5-navbar-visible');
        }
        else {
            document.body.classList.remove('h5-navbar-visible');
        }
    }, [shouldRender]);
    if (!shouldRender) {
        return _jsx(_Fragment, {});
    }
    const iconColor = navState.textStyle === 'white' ? '#fff' : '#333';
    const textColorClass = navState.textStyle === 'white' ? 'text-white' : 'text-gray-800';
    const getBgStyle = () => {
        if (navState.transparent === 'always') {
            return { backgroundColor: 'transparent' };
        }
        if (navState.transparent === 'auto') {
            return { backgroundColor: navState.bgColor, opacity: scrollOpacity };
        }
        return { backgroundColor: navState.bgColor };
    };
    const handleBack = () => Taro.navigateBack();
    const handleGoHome = () => {
        const homePage = getHomePage();
        Taro.reLaunch({ url: `/${homePage}` });
    };
    return (_jsxs(_Fragment, { children: [_jsxs(View, { className: "fixed top-0 left-0 right-0 h-11 flex items-center justify-center z-1000", style: getBgStyle(), children: [navState.leftIcon === LeftIcon.Back && (_jsx(View, { className: "absolute left-2 top-1/2 -translate-y-1/2 p-1 flex items-center justify-center", onClick: handleBack, children: _jsx(ChevronLeft, { size: 24, color: iconColor }) })), navState.leftIcon === LeftIcon.Home && (_jsx(View, { className: "absolute left-2 top-1/2 -translate-y-1/2 p-1 flex items-center justify-center", onClick: handleGoHome, children: _jsx(House, { size: 22, color: iconColor }) })), _jsx(Text, { className: `text-base font-medium max-w-3/5 truncate ${textColorClass}`, children: navState.title })] }), _jsx(View, { className: "h-11 shrink-0" })] }));
};
//# sourceMappingURL=h5-navbar.js.map