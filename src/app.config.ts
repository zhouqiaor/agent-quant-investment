export default typeof defineAppConfig === 'function'
  ? defineAppConfig({
    pages: [
      'pages/index/index',
      'pages/market/index',
      'pages/strategy/index',
      'pages/profile/index'
    ],
    window: {
      backgroundTextStyle: 'light',
      navigationBarBackgroundColor: '#0f172a',
      navigationBarTitleText: 'Agent Quant',
      navigationBarTextStyle: 'white',
      backgroundColor: '#0f172a'
    },
    tabBar: {
      color: '#94a3b8',
      selectedColor: '#10b981',
      backgroundColor: '#1e293b',
      borderStyle: 'black',
      list: [
        {
          pagePath: 'pages/index/index',
          text: '首页',
          iconPath: './assets/tabbar/layout-dashboard.png',
          selectedIconPath: './assets/tabbar/layout-dashboard-active.png'
        },
        {
          pagePath: 'pages/market/index',
          text: '行情',
          iconPath: './assets/tabbar/trending-up.png',
          selectedIconPath: './assets/tabbar/trending-up-active.png'
        },
        {
          pagePath: 'pages/strategy/index',
          text: '策略',
          iconPath: './assets/tabbar/brain.png',
          selectedIconPath: './assets/tabbar/brain-active.png'
        },
        {
          pagePath: 'pages/profile/index',
          text: '我的',
          iconPath: './assets/tabbar/user.png',
          selectedIconPath: './assets/tabbar/user-active.png'
        }
      ]
    }
  })
  : {
    pages: [
      'pages/index/index',
      'pages/market/index',
      'pages/strategy/index',
      'pages/profile/index'
    ],
    window: {
      backgroundTextStyle: 'light',
      navigationBarBackgroundColor: '#0f172a',
      navigationBarTitleText: 'Agent Quant',
      navigationBarTextStyle: 'white',
      backgroundColor: '#0f172a'
    },
    tabBar: {
      color: '#94a3b8',
      selectedColor: '#10b981',
      backgroundColor: '#1e293b',
      borderStyle: 'black',
      list: [
        {
          pagePath: 'pages/index/index',
          text: '首页',
          iconPath: './assets/tabbar/layout-dashboard.png',
          selectedIconPath: './assets/tabbar/layout-dashboard-active.png'
        },
        {
          pagePath: 'pages/market/index',
          text: '行情',
          iconPath: './assets/tabbar/trending-up.png',
          selectedIconPath: './assets/tabbar/trending-up-active.png'
        },
        {
          pagePath: 'pages/strategy/index',
          text: '策略',
          iconPath: './assets/tabbar/brain.png',
          selectedIconPath: './assets/tabbar/brain-active.png'
        },
        {
          pagePath: 'pages/profile/index',
          text: '我的',
          iconPath: './assets/tabbar/user.png',
          selectedIconPath: './assets/tabbar/user-active.png'
        }
      ]
    }
  }
