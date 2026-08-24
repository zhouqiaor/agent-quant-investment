export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '策略回测',
    navigationBarBackgroundColor: '#0f172a',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0f172a'
  })
  : {
    navigationBarTitleText: '策略回测',
    navigationBarBackgroundColor: '#0f172a',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0f172a'
  }
