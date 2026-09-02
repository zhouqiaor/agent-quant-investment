export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '交易记录' })
  : { navigationBarTitleText: '交易记录' }
