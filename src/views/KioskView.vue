<script setup lang="ts">
// 自助机模式 KioskView (M4)：竖屏大触屏自助点餐
// 特点：超大触控按钮、只读展示、自动回到首页、无顶部导航、全屏
// 复用 menu/cart/orders store，逻辑与 CustomerView 一致，但交互更"懒人"
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMenuStore } from '../store/menu'
import { useCartStore } from '../store/cart'
import { useOrdersStore } from '../store/orders'
import { useSettingsStore } from '../store/settings'
import { tl, lang } from '../i18n'
import type { Product, SourceKey } from '../models/types'
const langDisplay = computed(() => lang.value === 'zh' ? '中' : lang.value === 'en' ? 'EN' : 'NL')

const menu = useMenuStore()
const cart = useCartStore()
const orders = useOrdersStore()
const settings = useSettingsStore()

const activeCat = ref('all')

const currentDishes = computed(() => {
  if (activeCat.value === 'all') return menu.filteredProducts
  return menu.filteredProducts.filter((r: any) => (r.product.cat || '') === activeCat.value)
})

// 自增加购（自助机：点了就 +1，可重复点）
const addNotice = ref('')
let noticeTimer: number | null = null
function showAddNotice(msg: string) {
  addNotice.value = msg
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => (addNotice.value = ''), 1500)
}
function onAdd(p: Product) {
  if (p.opts && p.opts.length > 0) { openOpt(p); return }
  cart.addItem(p, [])
  showAddNotice(tl({ zh: '✅ 已加入购物车', en: '✅ Added to cart', nl: '✅ Toegevoegd' }))
}
function qtyOf(p: Product) { return cart.qty(p, []) }

// 选项弹窗
const optModal = ref(false)
const optProduct = ref<Product | null>(null)
const optSelections = ref<any[]>([])
function openOpt(p: Product) {
  optProduct.value = p
  optSelections.value = (p.opts || []).map((o) => ({ opt: o, chosen: [] }))
  optModal.value = true
}
function pickOpt(opt: any, choice: any) {
  const sel = optSelections.value.find((s) => s.opt.id === opt.id)
  if (!sel) return
  const c = { id: choice.id, name: tl(choice.name), delta: choice.delta }
  if (opt.type === 'single') sel.chosen = [c]
  else {
    const i = sel.chosen.findIndex((x: any) => x.id === c.id)
    if (i >= 0) sel.chosen.splice(i, 1)
    else sel.chosen.push(c)
  }
  optSelections.value = [...optSelections.value]
}
function confirmOpt() { if (optProduct.value) cart.addItem(optProduct.value, optSelections.value); optModal.value = false }

// 结算
const checkoutOpen = ref(false)
const checkoutStep = ref<'form' | 'done'>('form')
const placedSeq = ref<number | null>(null)
const dineType = ref<'dinein' | 'takeaway' | 'delivery'>('takeaway')
const tableNo = ref('')
const address = ref('')
const phone = ref('')

function openCheckout() {
  if (cart.isEmpty) return
  checkoutStep.value = 'form'
  checkoutOpen.value = true
}
async function submitOrder() {
  if (dineType.value === 'delivery' && (!address.value.trim() || !phone.value.trim())) {
    alert(tl({ zh: '外卖请填写地址和电话', en: 'Fill address & phone', nl: 'Vul adres & telefoon in' }))
    return
  }
  const items = cart.lines.map((l) => ({
    product: l.product, qty: l.qty, unitGross: l.unitGross, taxRate: 0.09, name: tl(l.product.name),
  }))
  const src: SourceKey = dineType.value === 'delivery' ? 'web' : dineType.value
  const o = await orders.createOrder({
    source: src, dine_type: dineType.value, items,
    table_no: tableNo.value || undefined,
    address: dineType.value === 'delivery' ? address.value : undefined,
    phone: dineType.value === 'delivery' ? phone.value : undefined,
    payment_method: 'cash',
  })
  placedSeq.value = o.seq
  checkoutStep.value = 'done'
}
function doneAndReset() {
  checkoutOpen.value = false
  cart.reset(); tableNo.value = ''; address.value = ''; phone.value = ''
}

// 自动回首页（空闲 timeout，settings.kiosk_timeout 默认 60s）
const IDLE_MS = 60000
let idleTimer: number | null = null
function resetIdle() {
  if (idleTimer) clearTimeout(idleTimer)
  const cfg = Number(settings.store?.kiosk_timeout || 0)
  idleTimer = window.setTimeout(() => {
    if (!checkoutOpen.value) { resetOrder(); }
  }, cfg > 0 ? cfg * 1000 : IDLE_MS)
}
function resetOrder() {
  cart.reset(); activeCat.value = 'all'; tableNo.value = ''; address.value = ''; phone.value = ''
}
function onAnyTap() { resetIdle() }

onMounted(async () => {
  if (!menu.loaded) await menu.load()
  if (!orders.loaded) await orders.load()
  if (!settings.loaded) await settings.load()
  resetIdle()
  window.addEventListener('pointerdown', onAnyTap)
  document.documentElement.requestFullscreen?.().catch(()=>{})
})
onUnmounted(() => {
  if (idleTimer) clearTimeout(idleTimer)
  window.removeEventListener('pointerdown', onAnyTap)
})
</script>

<template>
  <div class="kiosk" @pointerdown="onAnyTap">
    <!-- 顶栏 -->
    <header class="kiosk-top">
      <div class="kiosk-brand">
        <span class="kiosk-logo">🍽️</span>
        <div>
          <h1>{{ settings.store?.name || '达三江' }}</h1>
          <span class="kio-sub">{{ settings.store?.tagline || '' }}</span>
        </div>
      </div>
      <div class="kiosk-right">
        <span class="lang">🌐 {{ langDisplay }}</span>
        <button class="cart-btn" @click="openCheckout" :disabled="cart.isEmpty">
          🛒 <b>{{ cart.lineCount }}</b>
        </button>
      </div>
    </header>

    <!-- 加购提示 toast -->
    <transition name="toast">
      <div class="kio-toast" v-if="addNotice">{{ addNotice }}</div>
    </transition>

    <!-- 分类横向栏 -->
    <nav class="kiosk-cats">
      <button :class="{ sel: activeCat === 'all' }" @click="activeCat = 'all'">🏷️ 全部</button>
      <button v-for="c in menu.categories" :key="c.id" :class="{ sel: activeCat === c.id }" @click="activeCat = c.id">
        {{ c.icon }} {{ tl(c.name) }}
      </button>
    </nav>

    <!-- 菜品大网格 -->
    <main class="kiosk-grid">
      <button
        v-for="r in currentDishes"
        :key="r.product.id"
        class="kio-dish"
        :class="{ off: r.product.soldout || r.disabled }"
        @click="onAdd(r.product)"
      >
        <span class="dish-emoji">{{ r.product.img || '🍽️' }}</span>
        <span class="dish-name">{{ tl(r.product.name) }}</span>
        <span class="dish-price">€{{ r.product.price.toFixed(2) }}</span>
        <span class="qty-chip" v-if="qtyOf(r.product)">{{ qtyOf(r.product) }}</span>
      </button>
    </main>

    <!-- 选项弹窗 -->
    <div class="kio-mask" v-if="optModal" @click.self="optModal = false">
      <div class="kio-modal">
        <h2>{{ optProduct ? tl(optProduct.name) : '' }}</h2>
        <div v-for="sel in optSelections" :key="sel.opt.id" class="kio-opt">
          <div class="kio-opt-title">{{ tl(sel.opt.name) }}</div>
          <div class="kio-opt-choices">
            <button v-for="o in sel.opt.options" :key="o.id" class="kio-opt-chip"
              :class="{ sel: sel.chosen.some((c:any)=>c.id===o.id) }" @click="pickOpt(sel.opt, o)">
              {{ tl(o.name) }}<span v-if="o.delta" class="d">+€{{ o.delta.toFixed(2) }}</span>
            </button>
          </div>
        </div>
        <div class="kio-actions">
          <button class="kio-ghost" @click="optModal = false">取消</button>
          <button class="kio-primary" @click="confirmOpt">✔ 加入</button>
        </div>
      </div>
    </div>

    <!-- 结算 -->
    <div class="kio-mask" v-if="checkoutOpen" @click.self="checkoutStep === 'form' && (checkoutOpen=false)">
      <div class="kio-modal checkout">
        <template v-if="checkoutStep === 'form'">
          <h2>确认订单</h2>
          <div class="kio-dine">
            <button :class="{ sel: dineType==='dinein' }" @click="dineType='dinein'">🏠 堂食</button>
            <button :class="{ sel: dineType==='takeaway' }" @click="dineType='takeaway'">🥡 自取</button>
            <button :class="{ sel: dineType==='delivery' }" @click="dineType='delivery'">🛵 外卖</button>
          </div>
          <div class="kio-field" v-if="dineType !== 'delivery'">
            <label>{{ dineType==='dinein' ? '桌号' : '取餐号' }}</label>
            <input v-model="tableNo" placeholder="选填" />
          </div>
          <template v-if="dineType === 'delivery'">
            <div class="kio-field"><label>配送地址 *</label><input v-model="address" /></div>
            <div class="kio-field"><label>联系电话 *</label><input v-model="phone" type="tel" /></div>
          </template>
          <div class="kio-amounts">
            <div class="kio-row"><span>净额</span><b>€{{ (cart.grandTotal - cart.taxTotal).toFixed(2) }}</b></div>
            <div class="kio-row"><span>税额</span><b>€{{ cart.taxTotal.toFixed(2) }}</b></div>
            <div class="kio-row total"><span>总计</span><b>€{{ cart.grandTotal.toFixed(2) }}</b></div>
          </div>
          <div class="kio-actions">
            <button class="kio-ghost" @click="checkoutOpen=false">取消</button>
            <button class="kio-primary" @click="submitOrder">下单 · €{{ cart.grandTotal.toFixed(2) }}</button>
          </div>
        </template>
        <template v-else>
          <div class="kio-done">
            <div class="ok-big">✅</div>
            <h2>下单成功！</h2>
            <div class="kio-seq">取餐号 <b>{{ placedSeq }}</b></div>
            <button class="kio-primary big" @click="doneAndReset">完成</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kiosk {
  min-height: 100vh;
  background: #f6f0e8;
  display: flex; flex-direction: column;
  font-family: system-ui, -apple-system, 'PingFang SC', sans-serif;
  user-select: none;
}
/* 顶栏 */
.kiosk-top {
  background: var(--kiosk-hero, var(--primary));
  color: #fff; padding: 18px 26px;
  display: flex; align-items: center; justify-content: space-between;
}
.kiosk-brand { display: flex; align-items: center; gap: 14px; }
.kiosk-logo { font-size: 40px; }
.kiosk-brand h1 { font-size: 30px; margin: 0; }
.kio-sub { font-size: 15px; opacity: .85; }
.kiosk-right { display: flex; align-items: center; gap: 16px; }
.lang { font-size: 17px; background: rgba(255,255,255,.18); padding: 8px 14px; border-radius: 10px; }
.cart-btn {
  border: none; background: #fff; color: var(--primary);
  font-size: 20px; font-weight: 700; padding: 14px 24px; border-radius: 14px;
  box-shadow: 0 4px 14px rgba(0,0,0,.2);
}
.cart-btn:disabled { opacity: .5; }
/* 分类横栏 */
.kiosk-cats {
  display: flex; gap: 10px; padding: 16px 26px;
  overflow-x: auto; background: #fff; border-bottom: 1px solid #ece3d8;
}
.kiosk-cats button {
  border: 2px solid #ece3d8; background: #faf7f2;
  border-radius: 999px; padding: 14px 26px; font-size: 19px; font-weight: 600;
  white-space: nowrap; color: #5a4a3a;
}
.kiosk-cats button.sel { background: var(--primary); color: #fff; border-color: var(--primary); }
/* 菜品大网格：竖屏自助机用 3 列大格子 */
.kiosk-grid {
  flex: 1; padding: 24px 26px;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;
  align-content: start; overflow-y: auto;
}
.kio-dish {
  position: relative;
  background: #fff; border: none; border-radius: 20px;
  padding: 26px 16px; display: flex; flex-direction: column; align-items: center; gap: 8px;
  box-shadow: 0 3px 12px rgba(0,0,0,.07);
  cursor: pointer; transition: transform .12s ease, box-shadow .12s ease;
}
.kio-dish:active { transform: scale(.96); }
.kio-dish.off { opacity: .45; }
.dish-emoji { font-size: 56px; }
.dish-name { font-size: 20px; font-weight: 700; color: #3a2f24; }
.dish-price { font-size: 19px; color: var(--primary); font-weight: 800; }
.qty-chip {
  position: absolute; top: 10px; right: 10px;
  background: var(--primary); color: #fff; width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800;
}
/* 弹窗 */
.kio-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.kio-modal {
  background: #fff; border-radius: 24px; padding: 28px; width: 90%; max-width: 560px;
  max-height: 88vh; overflow-y: auto;
}
.kio-modal h2 { font-size: 26px; margin-bottom: 16px; }
.kio-actions { display: flex; gap: 12px; margin-top: 20px; }
.kio-ghost {
  flex: 1; padding: 18px; border-radius: 14px; border: 2px solid #ece3d8;
  background: #fff; font-size: 20px; font-weight: 600;
}
.kio-primary {
  flex: 2; padding: 18px; border-radius: 14px; border: none;
  background: var(--primary); color: #fff; font-size: 20px; font-weight: 800;
}
.kio-opt { margin-bottom: 14px; }
.kio-opt-title { font-size: 17px; font-weight: 600; color: #8a7a6a; margin-bottom: 8px; }
.kio-opt-choices { display: flex; flex-wrap: wrap; gap: 10px; }
.kio-opt-chip {
  border: 2px solid #ece3d8; background: #faf7f2; border-radius: 999px;
  padding: 14px 22px; font-size: 18px;
}
.kio-opt-chip.sel { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); font-weight: 700; }
.kio-opt-chip .d { font-size: 14px; opacity: .8; margin-left: 4px; }
/* 结算 */
.kio-dine { display: flex; gap: 10px; margin-bottom: 16px; }
.kio-dine button {
  flex: 1; padding: 16px; border-radius: 14px; border: 2px solid #ece3d8;
  background: #faf7f2; font-size: 19px; font-weight: 600;
}
.kio-dine button.sel { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
.kio-field { margin-bottom: 14px; }
.kio-field label { display: block; font-size: 15px; font-weight: 600; margin-bottom: 6px; }
.kio-field input {
  width: 100%; padding: 16px; border-radius: 12px; border: 2px solid #ece3d8; font-size: 19px;
}
.kio-amounts { background: #faf7f2; border-radius: 14px; padding: 14px 18px; }
.kio-row { display: flex; justify-content: space-between; font-size: 16px; padding: 4px 0; color: #8a7a6a; }
.kio-row.total { border-top: 1px solid #ece3d8; margin-top: 6px; padding-top: 10px; font-size: 18px; color: #3a2f24; }
.kio-row.total b { font-size: 26px; color: var(--primary); }
.kio-done { text-align: center; padding: 10px 0; }
.ok-big { font-size: 72px; }
.kio-seq { font-size: 20px; color: #8a7a6a; margin: 12px 0 20px; }
.kio-seq b { font-size: 40px; color: var(--primary); }
.kio-primary.big { width: 100%; padding: 22px; font-size: 24px; }

/* 加购提示 toast */
.kio-toast {
  position: fixed; top: 90px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.78); color: #fff; font-size: 22px; font-weight: 700;
  padding: 14px 30px; border-radius: 40px; z-index: 200;
  box-shadow: 0 6px 24px rgba(0,0,0,0.3); pointer-events: none;
  white-space: nowrap;
}
.toast-enter-active, .toast-leave-active { transition: opacity .25s, transform .25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -12px); }
</style>