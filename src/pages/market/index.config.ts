export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '行情' })
  : { navigationBarTitleText: '行情' }
