export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '100账户实时仿真' })
  : { navigationBarTitleText: '100账户实时仿真' }
