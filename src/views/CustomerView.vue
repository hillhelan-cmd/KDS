<script setup lang="ts">
// 主点餐视图 CustomerView —— 三端自适应（手机/平板/桌面/自助机）
// 结构：分类侧栏(左) + 过敏源面板 + 菜品网格(中) + 悬浮购物车(右下)
// 结算含「取餐形式」三选一：堂食/自取/外卖
import { ref, computed } from 'vue'
import { useMenuStore } from '../store/menu'
import { useCartStore, type CartLine } from '../store/cart'
import { useOrdersStore } from '../store/orders'
import { useSettingsStore } from '../store/settings'
import { tl, lang } from '../i18n'
import type { Product, ProductOpt } from '../models/types'
import DishCard from '../components/DishCard.vue'
import AllergenPanel from '../components/AllergenPanel.vue'

const menu = useMenuStore()
const cart = useCartStore()
const orders = useOrdersStore()
const settings = useSettingsStore()

// ---- 分类 ----
const activeCat = ref('all')
const activeCats = computed(() =>
  activeCat.value === 'all' ? menu.categories : menu.categories.filter((c) => c.id === activeCat.value),
)

// 当前显示分类下的菜品（含过敏源禁用标记）
const currentDishes = computed(() => {
  if (activeCat.value === 'all') return menu.filteredProducts
  return menu.filteredProducts.filter((r) => (r.product.cat || '') === activeCat.value)
})

// ---- 过敏源 ----
const showAllergen = ref(false)
function onToggleAllergen(key: string) { menu.toggleAllergen(key) }

// ---- 加购 ----
function onAdd(product: Product) {
  if (product.opts && product.opts.length > 0) {
    openOptModal(product)
    return
  }
  cart.addItem(product, [])
}
function onChange(delta: number, product: Product) {
  cart.changeQty(product, [], delta)
}
function qtyOf(product: Product) {
  return cart.qty(product, [])
}

// ---- 选项弹窗（含属性/加料）----
const optModal = ref(false)
const optProduct = ref<Product | null>(null)
const optSelections = ref<CartLine['optSelections']>([])
function openOptModal(p: Product) {
  optProduct.value = p
  optSelections.value = (p.opts || []).map((opt) => ({ opt, chosen: [] }))
  optModal.value = true
}
function pickOpt(opt: ProductOpt, choice: ProductOpt['options'][number]) {
  const sel = optSelections.value.find((s) => s.opt.id === opt.id)
  if (!sel) return
  const converted = { id: choice.id, name: tl(choice.name), delta: choice.delta }
  if (opt.type === 'single') {
    sel.chosen = [converted]
  } else {
    const exists = sel.chosen.find((c) => c.id === choice.id)
    if (exists) sel.chosen = sel.chosen.filter((c) => c.id !== choice.id)
    else sel.chosen = [...sel.chosen, converted]
  }
  optSelections.value = [...optSelections.value]
}
function confirmOpt() {
  if (!optProduct.value) return
  cart.addItem(optProduct.value, optSelections.value)
  optModal.value = false
}

// ---- 结算弹窗 ----
const checkoutOpen = ref(false)
const checkoutStep = ref<'form' | 'done'>('form')
const placedOrderSeq = ref<number | null>(null)

function openCheckout() {
  if (cart.isEmpty) return
  checkoutStep.value = 'form'
  checkoutOpen.value = true
}
function closeCheckout() {
  checkoutOpen.value = false
  cart.reset()
}
async function submitOrder() {
  // 校验：外卖必填地址电话（基础校验）
  if (cart.selectedDineType === 'delivery' && (!cart.address.trim() || !cart.phone.trim())) {
    alert(tl({ zh: '外卖请填写地址和电话', en: 'Please fill address & phone for delivery', nl: 'Vul adres en telefoon in voor bezorging' }))
    return
  }
  // 组装条目（带税率解析，由 main 装配 tax resolver）
  const items = cart.lines.map((l) => ({
    product: l.product,
    qty: l.qty,
    unitGross: l.unitGross,
    taxRate: 0.09, // 由 tax resolver 覆盖（cart 返回 taxBreakdown）
    name: tl(l.product.name),
  }))
  const source = cart.selectedDineType === 'delivery' ? 'web' : cart.selectedDineType === 'dinein' ? 'dinein' : 'takeaway'
  const order = await orders.createOrder({
    source,
    dine_type: cart.selectedDineType,
    items,
    table_no: cart.tableNo || undefined,
    address: cart.selectedDineType === 'delivery' ? cart.address : undefined,
    phone: cart.selectedDineType === 'delivery' ? cart.phone : undefined,
    delivery_fee: cart.deliveryTotal,
    remark: cart.remark || undefined,
    payment_method: 'cash',
  })
  placedOrderSeq.value = order.seq
  checkoutStep.value = 'done'
}

// ---- 敏感：过敏提示 ----
const infoModal = ref(false)
const infoProduct = ref<Product | null>(null)
function onInfo(p: Product) {
  infoProduct.value = p
  infoModal.value = true
}

// ---- 取餐形式 + 订单来源（点餐时即选定）----
import { SOURCES, sourceName, isExternalPlatform } from '../data/sources'
import type { SourceKey } from '../models/types'
// 当前选定的订单来源（堂食/自取对应 dinein/takeaway；外卖选平台，默认 web）
const currentSource = ref<SourceKey>('dinein')
// 三种取餐形式标签
const dineTabs: { key: 'dinein' | 'takeaway' | 'delivery'; icon: string; name: Record<string,string> }[] = [
  { key: 'dinein',    icon: '🏠', name: { zh: '堂食', en: 'Dine-in', nl: 'Ter plaatse' } },
  { key: 'takeaway',  icon: '🥡', name: { zh: '自取', en: 'Takeaway', nl: 'Meenemen' } },
  { key: 'delivery',  icon: '🛵', name: { zh: '外卖', en: 'Delivery', nl: 'Bezorging' } },
]
// 选外卖时展示的平台来源（web + 外部平台）
const externalSources = computed(() => SOURCES.filter((s) => s.key !== 'dinein' && s.key !== 'takeaway'))
// 选择取餐形式
function selectDineType(key: 'dinein' | 'takeaway' | 'delivery') {
  cart.selectedDineType = key
  // 同步 curren Source：堂食/自取固定对应；外卖默认 web（可在下拉再选平台）
  if (key === 'dinein') currentSource.value = 'dinein'
  else if (key === 'takeaway') currentSource.value = 'takeaway'
  else currentSource.value = 'web'
}
function selectSource(key: SourceKey) {
  currentSource.value = key
  // 选外部平台自动切到外卖
  if (isExternalPlatform(key) || key === 'web') cart.selectedDineType = 'delivery'
  else if (key === 'dinein') cart.selectedDineType = 'dinein'
  else if (key === 'takeaway') cart.selectedDineType = 'takeaway'
}

// 结算金额显示
const checkoutTax = computed(() => cart.taxTotal)
const checkoutNet = computed(() => Math.round((cart.grandTotal - cart.taxTotal) * 100) / 100)
</script>

<template>
  <div class="customer" :class="{ 'admin-mode': settings.store?.license_key }">
    <div class="layout">
      <!-- 左侧分类侧栏（桌面/平板显示） -->
      <aside class="cat-sidebar" v-if="menu.categories.length">
        <button
          class="cat-item"
          :class="{ active: activeCat === 'all' }"
          @click="activeCat = 'all'"
        >🏷️ {{ tl({ zh: '全部', en: 'All', nl: 'Alles' }) }}</button>
        <button
          v-for="c in menu.categories"
          :key="c.id"
          class="cat-item"
          :class="{ active: activeCat === c.id }"
          @click="activeCat = c.id"
        >{{ c.icon || '🍽️' }} {{ tl(c.name) }}</button>
      </aside>

      <!-- 中间内容 -->
      <section class="content">

        <!-- 取餐形式切换器（点餐时即选定） -->
        <div class="dine-switcher">
          <button
            v-for="d in dineTabs"
            :key="d.key"
            class="dine-tab"
            :class="{ sel: cart.selectedDineType === d.key }"
            @click="selectDineType(d.key)"
          >{{ d.icon }} {{ tl(d.name) }}</button>

          <!-- 外卖平台来源（仅外卖时显示） -->
          <div class="source-row" v-if="cart.selectedDineType === 'delivery'">
            <span class="source-label">{{ tl({ zh: '外卖来源', en: 'Source', nl: 'Bron' }) }}:</span>
            <button
              v-for="s in externalSources"
              :key="s.key"
              class="source-chip"
              :class="{ sel: currentSource === s.key }"
              @click="selectSource(s.key)"
            >{{ s.icon }} {{ sourceName(s.key, lang.value) }}</button>
          </div>
        </div>

        <!-- 过敏源开关（移动端折叠） -->
        <div class="allergen-toggle" @click="showAllergen = !showAllergen">
          <span>🧊 {{ tl({ zh: '过敏源过滤', en: 'Allergen filter', nl: 'Allergeenfilter' }) }}</span>
          <button class="fold">{{ showAllergen ? '▲' : '▼' }}</button>
        </div>
        <div v-show="showAllergen">
          <AllergenPanel
            :selected="menu.selectedAllergens"
            :active="menu.allergenActive"
            @toggle="onToggleAllergen"
            @clear="menu.clearAllergens"
          />
        </div>

        <!-- 菜品网格：全部视图（单网格） -->
        <div class="cat-block" v-if="activeCat === 'all'">
          <div class="dish-grid">
            <DishCard
              v-for="r in currentDishes"
              :key="r.product.id"
              :product="r.product"
              :qty="qtyOf(r.product)"
              :disabled="r.disabled"
              :matched-allergens="r.matched"
              @add="onAdd"
              @change="onChange"
              @info="onInfo"
            />
          </div>
        </div>

        <!-- 菜品网格：单分类视图（按分类分块） -->
        <div v-for="cat in activeCats" :key="cat.id" class="cat-block" v-else>
          <h2 class="cat-block-title">{{ cat.icon }} {{ tl(cat.name) }}</h2>
          <div class="dish-grid">
            <DishCard
              v-for="r in menu.filteredProducts.filter(x => (x.product.cat||'') === cat.id)"
              :key="r.product.id"
              :product="r.product"
              :qty="qtyOf(r.product)"
              :disabled="r.disabled"
              :matched-allergens="r.matched"
              @add="onAdd"
              @change="onChange"
              @info="onInfo"
            />
          </div>
        </div>
      </section>
    </div>

    <!-- 悬浮购物车 -->
    <div class="cart-fab" @click="openCheckout" v-if="!cart.isEmpty">
      <div class="cart-fab-info">
        <span class="cart-count">{{ cart.lineCount }}</span>
        <span class="cart-total">€{{ cart.grandTotal.toFixed(2) }}</span>
      </div>
      <span class="cart-fab-label">{{ tl({ zh: '结算', en: 'Checkout', nl: 'Afrekenen' }) }}</span>
    </div>

    <!-- 选项弹窗 -->
    <div class="modal-mask" v-if="optModal" @click.self="optModal = false">
      <div class="modal">
        <h3>{{ optProduct ? tl(optProduct.name) : '' }}</h3>
        <div v-for="sel in optSelections" :key="sel.opt.id" class="opt-group">
          <div class="opt-title">{{ tl(sel.opt.name) }} <small>({{ sel.opt.type === 'single' ? '单选' : '多选' }})</small></div>
          <div class="opt-choices">
            <button
              v-for="o in sel.opt.options"
              :key="o.id"
              class="opt-chip"
              :class="{ sel: sel.chosen.some(c => c.id === o.id) }"
              @click="pickOpt(sel.opt, o)"
            >{{ tl(o.name) }}<span v-if="o.delta" class="opt-delta">+€{{ o.delta.toFixed(2) }}</span></button>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="optModal = false">{{ tl({ zh: '取消', en: 'Cancel', nl: 'Annuleren' }) }}</button>
          <button class="btn-primary" @click="confirmOpt">✔ {{ tl({ zh: '加入', en: 'Add', nl: 'Toevoegen' }) }}</button>
        </div>
      </div>
    </div>

    <!-- 结算弹窗 -->
    <div class="modal-mask" v-if="checkoutOpen" @click.self="checkoutStep === 'form' && closeCheckout()">
      <div class="modal checkout">

        <template v-if="checkoutStep === 'form'">
          <h3>{{ tl({ zh: '确认订单', en: 'Confirm Order', nl: 'Bevestig Bestelling' }) }}</h3>

          <!-- 取餐形式三选一 -->
          <div class="dine-type">
            <button
              class="dine-opt"
              :class="{ sel: cart.selectedDineType === 'dinein' }"
              @click="cart.selectedDineType = 'dinein'"
            >🏠 {{ tl({ zh: '堂食', en: 'Dine-in', nl: 'Ter plaatse' }) }}</button>
            <button
              class="dine-opt"
              :class="{ sel: cart.selectedDineType === 'takeaway' }"
              @click="cart.selectedDineType = 'takeaway'"
            >🥡 {{ tl({ zh: '自取', en: 'Takeaway', nl: 'Meenemen' }) }}</button>
            <button
              class="dine-opt"
              :class="{ sel: cart.selectedDineType === 'delivery' }"
              @click="cart.selectedDineType = 'delivery'"
            >🛵 {{ tl({ zh: '外卖', en: 'Delivery', nl: 'Bezorging' }) }}</button>
          </div>

          <!-- 堂食/自取：桌号/取餐号 -->
          <div class="field" v-if="cart.selectedDineType === 'dinein' || cart.selectedDineType === 'takeaway'">
            <label>{{ cart.selectedDineType === 'dinein' ? tl({ zh: '桌号', en: 'Table', nl: 'Tafel' }) : tl({ zh: '取餐号', en: 'Pickup No.', nl: 'Afhaalnr.' }) }}</label>
            <input v-model="cart.tableNo" :placeholder="tl({ zh: '选填', en: 'Optional', nl: 'Optioneel' })" />
          </div>

          <!-- 外卖：地址+电话+配送费 -->
          <template v-if="cart.selectedDineType === 'delivery'">
            <div class="field">
              <label>{{ tl({ zh: '配送地址', en: 'Address', nl: 'Adres' }) }} <b class="req">*</b></label>
              <input v-model="cart.address" :placeholder="tl({ zh: '街道/门牌/城市', en: 'Street / city', nl: 'Straat / stad' })" />
            </div>
            <div class="field">
              <label>{{ tl({ zh: '联系电话', en: 'Phone', nl: 'Telefoon' }) }} <b class="req">*</b></label>
              <input v-model="cart.phone" type="tel" :placeholder="tl({ zh: '手机号', en: 'Phone number', nl: 'Telefoonnummer' })" />
            </div>
            <div class="field">
              <label>{{ tl({ zh: '配送费', en: 'Delivery fee', nl: 'Bezorgkosten' }) }}</label>
              <input v-model.number="cart.deliveryFee" type="number" min="0" step="0.5" />
            </div>
          </template>

          <div class="field">
            <label>{{ tl({ zh: '备注', en: 'Note', nl: 'Opmerking' }) }}</label>
            <input v-model="cart.remark" :placeholder="tl({ zh: '选填', en: 'Optional', nl: 'Optioneel' })" />
          </div>

          <!-- 金额明细（会计口径） -->
          <div class="amounts">
            <div class="amount-row"><span>{{ tl({ zh: '净额(不含税)', en: 'Net (excl. VAT)', nl: 'Netto (excl. BTW)' }) }}</span><b>€{{ checkoutNet.toFixed(2) }}</b></div>
            <div class="amount-row"><span>{{ tl({ zh: '税额(BTW)', en: 'VAT', nl: 'BTW' }) }}</span><b>€{{ checkoutTax.toFixed(2) }}</b></div>
            <div class="amount-row total"><span>{{ tl({ zh: '含税总计', en: 'Total', nl: 'Totaal' }) }}</span><b>€{{ cart.grandTotal.toFixed(2) }}</b></div>
          </div>

          <div class="modal-actions">
            <button class="btn-cancel" @click="closeCheckout">{{ tl({ zh: '取消', en: 'Cancel', nl: 'Annuleren' }) }}</button>
            <button class="btn-primary" @click="submitOrder">{{ tl({ zh: '下单', en: 'Place Order', nl: 'Plaats' }) }} · €{{ cart.grandTotal.toFixed(2) }}</button>
          </div>
        </template>

        <template v-else>
          <div class="done">
            <div class="ok-mark">✅</div>
            <h3>{{ tl({ zh: '下单成功！', en: 'Order placed!', nl: 'Bestelling geplaatst!' }) }}</h3>
            <p class="seq">{{ tl({ zh: '取餐号', en: 'Pickup No.', nl: 'Afhaalnr.' }) }} <b>{{ placedOrderSeq }}</b></p>
            <button class="btn-primary" @click="closeCheckout">{{ tl({ zh: '完成', en: 'Done', nl: 'Klaar' }) }}</button>
          </div>
        </template>
      </div>
    </div>

    <!-- 过敏提示弹窗 -->
    <div class="modal-mask" v-if="infoModal" @click.self="infoModal = false">
      <div class="modal">
        <h3>⚠️ {{ infoProduct ? tl(infoProduct.name) : '' }}</h3>
        <p class="info-text">{{ tl({ zh: '本菜品含有以下过敏原，可能不适合过敏体质人群。', en: 'This dish contains allergens that may not be suitable for people with allergies.', nl: 'Dit gerecht bevat allergenen die mogelijk niet geschikt zijn voor mensen met allergieën.' }) }}</p>
        <div class="allergen-list" v-if="infoProduct">
          <span v-for="a in infoProduct.allergens" :key="a" class="allergen-tag">⚠️ {{ a }}</span>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" @click="infoModal = false">{{ tl({ zh: '知道了', en: 'Got it', nl: 'Begrepen' }) }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.customer { min-height: 100%; }
.layout { display: flex; gap: 16px; align-items: flex-start; }

.cat-sidebar {
  width: 150px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 4px;
  position: sticky; top: 64px;
}
.cat-item {
  text-align: left; padding: 10px 12px; border-radius: 10px;
  border: none; background: transparent; font-size: 14px; font-weight: 600;
  transition: all 0.15s; color: var(--text);
}
.cat-item.active { background: var(--primary); color: #fff; }
.cat-item:hover:not(.active) { background: var(--border); }

.content { flex: 1; min-width: 0; }
.cat-block { margin-bottom: 16px; }
.cat-block-title { font-size: 17px; margin-bottom: 10px; padding: 0 2px; }
.dish-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

/* 悬浮购物车 */
.cart-fab {
  position: fixed; right: 16px; bottom: 16px; z-index: 60;
  background: var(--primary); color: #fff;
  border-radius: 999px; padding: 12px 20px;
  display: flex; align-items: center; gap: 12px;
  box-shadow: 0 6px 20px rgba(229,117,31,0.4);
  cursor: pointer; animation: float-in 0.3s ease;
}
@keyframes float-in { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
.cart-fab-info { display: flex; align-items: center; gap: 8px; }
.cart-count {
  background: #fff; color: var(--primary);
  min-width: 24px; height: 24px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 14px; padding: 0 5px;
}
.cart-total { font-weight: 800; font-size: 18px; }
.cart-fab-label { font-weight: 700; font-size: 15px; border-left: 1px solid rgba(255,255,255,0.4); padding-left: 12px; }

/* 过敏源开关 */
.allergen-toggle {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow);
  padding: 10px 14px; margin-bottom: 10px; cursor: pointer; font-weight: 600; font-size: 14px;
}
.allergen-toggle .fold { border: none; background: none; font-size: 11px; color: var(--muted); }

/* 弹窗 */
.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.modal {
  background: var(--card); border-radius: 20px; max-width: 460px; width: 100%;
  padding: 20px; max-height: 90vh; overflow-y: auto;
}
.modal h3 { font-size: 18px; margin-bottom: 12px; }
.opt-group { margin-bottom: 12px; }
.opt-title { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 6px; }
.opt-choices { display: flex; flex-wrap: wrap; gap: 6px; }
.opt-chip {
  border: 1.5px solid var(--border); background: var(--card);
  padding: 8px 14px; border-radius: 20px; font-size: 13px;
}
.opt-chip.sel { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); font-weight: 600; }
.opt-delta { color: var(--primary); font-size: 11px; margin-left: 3px; }
.modal-actions { display: flex; gap: 10px; margin-top: 16px; }
.btn-cancel {
  flex: 1; padding: 12px; border-radius: 12px;
  border: 1px solid var(--border); background: var(--card); font-weight: 600;
}
.btn-primary {
  flex: 2; padding: 12px; border-radius: 12px;
  border: none; background: var(--primary); color: #fff; font-weight: 700; font-size: 15px;
}

/* 取餐形式 */
.dine-type { display: flex; gap: 8px; margin-bottom: 14px; }
.dine-opt {
  flex: 1; padding: 14px 6px; border-radius: 12px;
  border: 2px solid var(--border); background: var(--card);
  font-size: 14px; font-weight: 600; color: var(--text);
  transition: all 0.15s;
}
.dine-opt.sel { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }

.field { margin-bottom: 12px; }
.field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 5px; }
.field .req { color: var(--danger); }
.field input {
  width: 100%; padding: 11px 12px; border-radius: 10px;
  border: 1.5px solid var(--border); font-size: 14px;
}
.field input:focus { outline: none; border-color: var(--primary); }

.amounts { background: var(--bg); border-radius: 12px; padding: 12px; margin-top: 6px; }
.amount-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; color: var(--muted); }
.amount-row.total { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 8px; font-size: 15px; color: var(--text); }
.amount-row.total b { color: var(--primary); font-size: 18px; }

.done { text-align: center; padding: 12px 0; }
.ok-mark { font-size: 52px; }
.done .seq { font-size: 15px; margin: 8px 0 16px; color: var(--muted); }
.done .seq b { font-size: 26px; color: var(--primary); }
.done .btn-primary { width: 100%; }

.info-text { color: var(--muted); font-size: 14px; margin-bottom: 12px; }
.allergen-list { display: flex; flex-wrap: wrap; gap: 6px; }
.allergen-tag { background: var(--danger); color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 12px; }

/* 自适应：手机 → 平板 → 桌面 → 自助机 */
@media (min-width: 768px) { .dish-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 1280px) { .dish-grid { grid-template-columns: repeat(6, 1fr); } }
@media (min-width: 1920px) { .dish-grid { grid-template-columns: repeat(8, 1fr); } }
/* 手机隐藏侧栏（用横向分类滚动条替代） */
@media (max-width: 600px) {
  .cat-sidebar { display: none; }
}

/* ---- 取餐形式切换器（极简风） ---- */
.dine-switcher {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 8px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.dine-tab {
  flex: 1;
  min-width: 90px;
  border: 1px solid var(--border);
  background: transparent;
  border-radius: 10px;
  padding: 8px 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  transition: all .18s ease;
}
.dine-tab.sel {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}
.source-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  width: 100%;
  border-top: 1px dashed var(--border);
  padding-top: 8px;
  margin-top: 2px;
}
.source-label { font-size: 12px; color: var(--muted); margin-right: 2px; }
.source-chip {
  border: 1px solid var(--border);
  background: transparent;
  border-radius: 20px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--muted);
  transition: all .18s ease;
}
.source-chip.sel {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
  font-weight: 600;
}
</style>