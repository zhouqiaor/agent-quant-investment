export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '创建策略' })
  : { navigationBarTitleText: '创建策略' }
