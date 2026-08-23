export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '策略' })
  : { navigationBarTitleText: '策略' }
