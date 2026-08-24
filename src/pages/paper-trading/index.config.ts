export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '模拟交易',
    navigationBarBackgroundColor: '#0f172a',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0f172a'
  })
  : {
    navigationBarTitleText: '模拟交易',
    navigationBarBackgroundColor: '#0f172a',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0f172a'
  }
