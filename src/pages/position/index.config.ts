export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '持仓详情' })
  : { navigationBarTitleText: '持仓详情' }
