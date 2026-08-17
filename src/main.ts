import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import { useMenuStore } from './store/menu'
import { useCartStore } from './store/cart'
import { useOrdersStore } from './store/orders'
import { useSettingsStore } from './store/settings'
import { watchNetwork } from './modules/sync/adapter'
import App from './App.vue'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')

// ---- 启动引导：加载本地数据 + 装配税率解析 + 网络监听（本地优先）----
async function bootstrap() {
  // IndexedDB 本地库
  const menu = useMenuStore()
  const cart = useCartStore()
  const orders = useOrdersStore()
  const settings = useSettingsStore()

  await Promise.all([menu.load(), orders.load(), settings.load()])

  // 装配购物车税率解析（从税率表取，默认 9% 食品档）
  const rateById = new Map(menu.taxRates.map((r) => [r.id, r.rate]))
  const taxResolver = (p: { tax_rate_id?: string }) => {
    if (p.tax_rate_id && rateById.has(p.tax_rate_id)) return rateById.get(p.tax_rate_id)!
    return 0.09
  }
  cart.configureTaxResolver(taxResolver as any)

  // 网络状态监听：M2 触发自动同步（暂只刷新 UI 标识）
  watchNetwork(() => {
    // TODO(M2): 网络恢复时触发 runSync()
  })
}

bootstrap()