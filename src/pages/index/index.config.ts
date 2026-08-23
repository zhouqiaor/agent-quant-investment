export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: 'Agent Quant' })
  : { navigationBarTitleText: 'Agent Quant' }
