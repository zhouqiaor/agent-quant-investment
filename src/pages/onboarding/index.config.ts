export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '开启内测体验' })
  : { navigationBarTitleText: '开启内测体验' }
