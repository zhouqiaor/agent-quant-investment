export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '策略 A/B 对比实验',
      enableShareAppMessage: true,
    })
  : { navigationBarTitleText: '策略 A/B 对比实验' }
