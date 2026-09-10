import Taro from '@tarojs/taro';
/**
 * 网络请求模块
 * 封装 Taro.request、Taro.uploadFile、Taro.downloadFile，自动添加项目域名前缀
 * 如果请求的 url 以 http:// 或 https:// 开头，则不会添加域名前缀
 *
 * IMPORTANT: 项目已经全局注入 PROJECT_DOMAIN
 * IMPORTANT: 除非你需要添加全局参数，如给所有请求加上 header，否则不能修改此文件
 */
export var Network;
(function (Network) {
    const createUrl = (url) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        return `${PROJECT_DOMAIN}${url}`;
    };
    Network.request = option => {
        return Taro.request(Object.assign(Object.assign({}, option), { url: createUrl(option.url) }));
    };
    Network.uploadFile = option => {
        return Taro.uploadFile(Object.assign(Object.assign({}, option), { url: createUrl(option.url) }));
    };
    Network.downloadFile = option => {
        return Taro.downloadFile(Object.assign(Object.assign({}, option), { url: createUrl(option.url) }));
    };
})(Network || (Network = {}));
//# sourceMappingURL=network.js.map