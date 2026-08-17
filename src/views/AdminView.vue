<script setup lang="ts">
// 后台管理 (M2)：商家设置 / 菜单(菜品·分类·税率)管理
import { ref, computed, onMounted } from 'vue'
import { useMenuStore } from '../store/menu'
import { useSettingsStore } from '../store/settings'
import type { Product, Category, TaxRate } from '../models/types'
import { ALLERGEN_TAGS, type AllergenKey } from '../modules/allergen'

const menu = useMenuStore()
const settings = useSettingsStore()

const tab = ref<'store' | 'products' | 'categories' | 'taxes'>('products')
const loaded = ref(false)
const saving = ref(false)
const msg = ref('')

onMounted(async () => {
  if (!menu.loaded) await menu.load()
  if (!settings.loaded) await settings.load()
  const s = settings.store
  if (s) {
    storeForm.value = {
      name: s.name || '', tagline: s.tagline || '', address: s.address || '',
      vat_no: s.vat_no || '', phone: s.phone || '', theme: (s.theme as ThemeKey) || 'business',
    }
  } else {
    await settings.save({})
    storeForm.value = { name: settings.store?.name || '达三江', theme: 'business' }
  }
  loaded.value = true
})

function notify(s: string) {
  msg.value = s
  setTimeout(() => (msg.value = ''), 2500)
}

// ---- 商家设置 ----
import { THEMES, applyTheme } from '../core/theme'
import type { ThemeKey } from '../models/types'

const storeForm = ref({ name: '', tagline: '', address: '', vat_no: '', phone: '', theme: 'business' as ThemeKey })
async function saveStore() {
  saving.value = true
  await settings.save(storeForm.value)
  // 保存后立即应用主题，店主所见即所得
  applyTheme(storeForm.value.theme as ThemeKey)
  saving.value = false
  notify('商家设置已保存 ✅')
}
function pickTheme(k: ThemeKey) {
  storeForm.value.theme = k
  applyTheme(k) // 预览即时生效
}

// ---- 菜品管理 ----
const productQuery = ref('')
const filteredProducts = computed(() => {
  const q = productQuery.value.trim().toLowerCase()
  if (!q) return menu.products
  return menu.products.filter((p) =>
    (p.name?.zh || '').toLowerCase().includes(q) || (p.name?.en || '').toLowerCase().includes(q))
})

// 新增/编辑弹窗
const showProductModal = ref(false)
const editingId = ref<string | null>(null)
const prodForm = ref<{
  nameZh: string; nameEn: string; nameNl: string; price: number;
  cat: string; tax_rate_id: string; img: string; alrg: string;
  allergens: AllergenKey[]; soldout: boolean; descZh: string
}>({ nameZh: '', nameEn: '', nameNl: '', price: 0, cat: '', tax_rate_id: '', img: '🍽️', alrg: '', allergens: [], soldout: false, descZh: '' })

function openNewProduct() {
  editingId.value = null
  prodForm.value = {
    nameZh: '', nameEn: '', nameNl: '', price: 0,
    cat: menu.categories[0]?.id || '', tax_rate_id: menu.taxRates[0]?.id || '',
    img: '🍽️', alrg: '', allergens: [], soldout: false, descZh: '',
  }
  showProductModal.value = true
}
function openEditProduct(p: Product) {
  editingId.value = p.id
  prodForm.value = {
    nameZh: p.name?.zh || '', nameEn: p.name?.en || '', nameNl: p.name?.nl || '',
    price: p.price, cat: p.cat || '', tax_rate_id: p.tax_rate_id || '',
    img: p.img || '🍽️', alrg: p.alrg || '', allergens: [...(p.allergens || [])],
    soldout: !!p.soldout, descZh: p.desc?.zh || '',
  }
  showProductModal.value = true
}
function toggleAllergenInForm(a: AllergenKey) {
  const i = prodForm.value.allergens.indexOf(a)
  if (i >= 0) prodForm.value.allergens.splice(i, 1)
  else prodForm.value.allergens.push(a)
}
async function saveProduct() {
  if (!prodForm.value.nameZh) return notify('请填中文名')
  const data: Partial<Product> = {
    name: { zh: prodForm.value.nameZh, en: prodForm.value.nameEn || prodForm.value.nameZh, nl: prodForm.value.nameNl || prodForm.value.nameZh },
    price: Number(prodForm.value.price) || 0,
    cat: prodForm.value.cat || undefined,
    tax_rate_id: prodForm.value.tax_rate_id || menu.taxRates[0]?.id || '',
    img: prodForm.value.img || undefined,
    alrg: prodForm.value.alrg || undefined,
    desc: prodForm.value.descZh ? { zh: prodForm.value.descZh } : undefined,
    allergens: prodForm.value.allergens,
    soldout: prodForm.value.soldout,
  }
  saving.value = true
  if (editingId.value) await menu.updateProduct(editingId.value, data)
  else await menu.addProduct(data)
  saving.value = false
  showProductModal.value = false
  notify(editingId.value ? '菜品已更新 ✅' : '菜品已新增 ✅')
}
async function removeProduct(id: string, name: string) {
  if (!confirm(`确定删除「${name}」？此操作不可撤销。`)) return
  await menu.deleteProduct(id)
  notify('已删除')
}

// ---- 分类管理 ----
const showCatModal = ref(false)
const catForm = ref({ id: '', nameZh: '', nameEn: '', nameNl: '', icon: '🍽️' })
function openNewCat() { catForm.value = { id: '', nameZh: '', nameEn: '', nameNl: '', icon: '🍽️' }; showCatModal.value = true }
function openEditCat(c: Category) {
  catForm.value = { id: c.id, nameZh: c.name?.zh || '', nameEn: c.name?.en || '', nameNl: c.name?.nl || '', icon: c.icon || '🍽️' }
  showCatModal.value = true
}
async function saveCat() {
  if (!catForm.value.nameZh) return notify('请填分类名')
  const data: Partial<Category> = {
    name: { zh: catForm.value.nameZh, en: catForm.value.nameEn || catForm.value.nameZh, nl: catForm.value.nameNl || catForm.value.nameZh },
    icon: catForm.value.icon,
  }
  if (catForm.value.id) await menu.updateCategory(catForm.value.id, data)
  else await menu.addCategory(data)
  showCatModal.value = false
  notify('分类已保存 ✅')
}
async function removeCat(id: string, name: string) {
  if (!confirm(`确定删除分类「${name}」？`)) return
  await menu.deleteCategory(id)
  notify('已删除分类')
}

// ---- 税率管理 ----
const showTaxModal = ref(false)
const taxForm = ref({ id: '', name: '', rate: 0.09 })
function openNewTax() { taxForm.value = { id: '', name: '', rate: 0.09 }; showTaxModal.value = true }
function openEditTax(t: TaxRate) { taxForm.value = { id: t.id, name: t.name, rate: t.rate }; showTaxModal.value = true }
async function saveTax() {
  if (!taxForm.value.name) return notify('请填税率名')
  if (!taxForm.value.id) await menu.addTaxRate({ name: taxForm.value.name, rate: Number(taxForm.value.rate) })
  else await menu.updateTaxRate(taxForm.value.id, { name: taxForm.value.name, rate: Number(taxForm.value.rate) })
  showTaxModal.value = false
  notify('税率已保存 ✅')
}
async function removeTax(id: string, name: string) {
  if (!confirm(`确定删除税率「${name}」？`)) return
  await menu.deleteTaxRate(id)
  notify('已删除税率')
}

const catName = (id?: string) => menu.categories.find((c) => c.id === id)?.name?.zh || '—'
const taxName = (id?: string) => menu.taxRates.find((t) => t.id === id)?.name || '—'

function backToCustomer() { window.location.href = '/' }
</script>

<template>
  <div class="admin-view">
    <header class="admin-top">
      <div class="admin-brand">
        <button class="back-btn" @click="backToCustomer">←</button>
        <h2>⚙️ 后台管理</h2>
      </div>
      <div class="admin-store">{{ settings.store?.name || '达三江' }}</div>
    </header>

    <nav class="admin-tabs">
      <button :class="{ sel: tab === 'store' }" @click="tab = 'store'">🏪 店铺</button>
      <button :class="{ sel: tab === 'products' }" @click="tab = 'products'">🍽️ 菜品</button>
      <button :class="{ sel: tab === 'categories' }" @click="tab = 'categories'">🗂️ 分类</button>
      <button :class="{ sel: tab === 'taxes' }" @click="tab = 'taxes'">🧾 税率</button>
    </nav>

    <div class="flash" v-if="msg">{{ msg }}</div>

    <div v-if="!loaded" class="card loading">加载中…</div>

    <!-- 店铺设置 -->
    <div v-else-if="tab === 'store'" class="card form-card">
      <h3>店铺信息</h3>
      <label>店铺名</label>
      <input v-model="storeForm.name" placeholder="达三江" />
      <label>标语 / Tagline</label>
      <input v-model="storeForm.tagline" placeholder="正宗中餐" />
      <label>地址</label>
      <input v-model="storeForm.address" />
      <label>税号 (VAT)</label>
      <input v-model="storeForm.vat_no" />
      <label>电话</label>
      <input v-model="storeForm.phone" />

      <h3 class="sec-title">外观主题（全局生效）</h3>
      <div class="theme-row">
        <div
          v-for="t in THEMES"
          :key="t.key"
          class="theme-card"
          :class="{ sel: storeForm.theme === t.key }"
          @click="pickTheme(t.key)"
        >
          <div class="theme-swatch" :data-th="t.key">
            <span class="sw-logo">🍽️</span>
            <span class="sw-line"></span>
            <span class="sw-line short"></span>
          </div>
          <div class="theme-name">{{ t.zh }}</div>
          <div class="theme-desc">{{ t.desc }}</div>
        </div>
      </div>

      <button class="btn-primary" :disabled="saving" @click="saveStore">{{ saving ? '保存中…' : '保存店铺设置' }}</button>
    </div>

    <!-- 菜品管理 -->
    <div v-else-if="tab === 'products'" class="card">
      <div class="list-head">
        <h3>菜品管理（{{ menu.products.length }}）</h3>
        <div class="list-actions">
          <input v-model="productQuery" class="search" placeholder="搜索…" />
          <button class="btn-primary" @click="openNewProduct">＋ 新增菜品</button>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr><th>菜品</th><th>价格</th><th>分类</th><th>税率</th><th>过敏</th><th>状态</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredProducts" :key="p.id">
            <td><span class="prod-img">{{ p.img || '🍽️' }}</span> {{ p.name?.zh || '未命名' }}</td>
            <td>€{{ p.price.toFixed(2) }}</td>
            <td>{{ catName(p.cat) }}</td>
            <td>{{ taxName(p.tax_rate_id) }}</td>
            <td>{{ (p.allergens || []).length ? p.allergens.map(a => ALLERGEN_TAGS.find(x=>x.key===a)?.label.zh || a).join('、') : '—' }}</td>
            <td><span class="st" :class="{ off: p.soldout }">{{ p.soldout ? '售罄' : '在售' }}</span></td>
            <td class="row-actions">
              <button class="mini" @click="openEditProduct(p)">✏️</button>
              <button class="mini danger" @click="removeProduct(p.id, p.name?.zh || '')">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分类管理 -->
    <div v-else-if="tab === 'categories'" class="card">
      <div class="list-head">
        <h3>分类管理（{{ menu.categories.length }}）</h3>
        <button class="btn-primary" @click="openNewCat">＋ 新增分类</button>
      </div>
      <table class="data-table">
        <thead><tr><th>图标</th><th>分类名</th><th>排序</th><th></th></tr></thead>
        <tbody>
          <tr v-for="c in [...menu.categories].sort((a,b)=>(a.sort||0)-(b.sort||0))" :key="c.id">
            <td>{{ c.icon || '🍽️' }}</td>
            <td>{{ c.name?.zh || c.id }}</td>
            <td>{{ c.sort ?? '—' }}</td>
            <td class="row-actions">
              <button class="mini" @click="openEditCat(c)">✏️</button>
              <button class="mini danger" @click="removeCat(c.id, c.name?.zh || '')">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 税率管理 -->
    <div v-else-if="tab === 'taxes'" class="card">
      <div class="list-head">
        <h3>税率管理（{{ menu.taxRates.length }}）</h3>
        <button class="btn-primary" @click="openNewTax">＋ 新增税率</button>
      </div>
      <table class="data-table">
        <thead><tr><th>名称</th><th>税率</th><th></th></tr></thead>
        <tbody>
          <tr v-for="t in menu.taxRates" :key="t.id">
            <td>{{ t.name }}</td>
            <td>{{ (t.rate * 100).toFixed(1) }}%</td>
            <td class="row-actions">
              <button class="mini" @click="openEditTax(t)">✏️</button>
              <button class="mini danger" @click="removeTax(t.id, t.name)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 菜品弹窗 -->
    <div class="modal-mask" v-if="showProductModal" @click.self="showProductModal = false">
      <div class="modal wide">
        <h3>{{ editingId ? '编辑菜品' : '新增菜品' }}</h3>
        <div class="form-grid">
          <div><label>中文名 *</label><input v-model="prodForm.nameZh" /></div>
          <div><label>英文名</label><input v-model="prodForm.nameEn" /></div>
          <div><label>荷兰文</label><input v-model="prodForm.nameNl" /></div>
          <div><label>价格 (€) *</label><input v-model.number="prodForm.price" type="number" step="0.1" /></div>
          <div><label>分类</label>
            <select v-model="prodForm.cat">
              <option v-for="c in menu.categories" :key="c.id" :value="c.id">{{ c.name?.zh }}</option>
            </select>
          </div>
          <div><label>税率</label>
            <select v-model="prodForm.tax_rate_id">
              <option v-for="t in menu.taxRates" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
          <div><label>图标 (emoji)</label><input v-model="prodForm.img" /></div>
        </div>
        <label>过敏源文本（如：含花生/麸质）</label>
        <input v-model="prodForm.alrg" placeholder="留空则自动按标签显示" />
        <label>过敏源标签</label>
        <div class="allergen-pick">
          <button v-for="a in ALLERGEN_TAGS" :key="a.key" class="chip" :class="{ sel: prodForm.allergens.includes(a.key) }"
            @click="toggleAllergenInForm(a.key)">{{ a.label.zh }}</button>
        </div>
        <label class="inline-check"><input type="checkbox" v-model="prodForm.soldout" /> 售罄</label>
        <div class="modal-actions">
          <button class="btn-ghost" @click="showProductModal = false">取消</button>
          <button class="btn-primary" :disabled="saving" @click="saveProduct">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 分类弹窗 -->
    <div class="modal-mask" v-if="showCatModal" @click.self="showCatModal = false">
      <div class="modal">
        <h3>{{ catForm.id ? '编辑分类' : '新增分类' }}</h3>
        <label>中文名 *</label><input v-model="catForm.nameZh" />
        <label>英文名</label><input v-model="catForm.nameEn" />
        <label>荷兰文</label><input v-model="catForm.nameNl" />
        <label>图标</label><input v-model="catForm.icon" />
        <div class="modal-actions">
          <button class="btn-ghost" @click="showCatModal = false">取消</button>
          <button class="btn-primary" @click="saveCat">保存</button>
        </div>
      </div>
    </div>

    <!-- 税率弹窗 -->
    <div class="modal-mask" v-if="showTaxModal" @click.self="showTaxModal = false">
      <div class="modal">
        <h3>{{ taxForm.id ? '编辑税率' : '新增税率' }}</h3>
        <label>名称 *</label><input v-model="taxForm.name" placeholder="如：食品 9%" />
        <label>税率（小数）*</label><input v-model.number="taxForm.rate" type="number" step="0.01" placeholder="0.09" />
        <div class="modal-actions">
          <button class="btn-ghost" @click="showTaxModal = false">取消</button>
          <button class="btn-primary" @click="saveTax">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-view { max-width: 1100px; margin: 0 auto; padding: 14px 16px; }
.admin-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.admin-brand { display: flex; align-items: center; gap: 8px; }
.admin-brand h2 { font-size: 19px; }
.back-btn { border: 1px solid var(--border); background: var(--card); border-radius: 8px; padding: 4px 10px; font-size: 15px; }
.admin-store { color: var(--muted); font-size: 13px; }
.admin-tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.admin-tabs button { border: 1px solid var(--border); background: var(--card); border-radius: 10px; padding: 8px 16px; font-size: 14px; font-weight: 600; color: var(--muted); }
.admin-tabs button.sel { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
.flash { background: var(--primary-soft); color: var(--primary); padding: 9px 14px; border-radius: 10px; margin-bottom: 12px; font-size: 14px; font-weight: 600; }
.form-card label, .modal label { display: block; font-size: 12px; color: var(--muted); margin: 10px 0 4px; }
.form-card input, .modal input, .modal select { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 9px 11px; font-size: 14px; }
.form-card .btn-primary, .modal .btn-primary { margin-top: 16px; }
.list-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
.list-actions { display: flex; gap: 8px; }
.search { border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; font-size: 13px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { text-align: left; color: var(--muted); font-weight: 600; padding: 8px 10px; border-bottom: 1px solid var(--border); }
.data-table td { padding: 9px 10px; border-bottom: 1px solid var(--border); }
.prod-img { font-size: 17px; margin-right: 4px; }
.st { color: var(--ok); font-weight: 600; }
.st.off { color: var(--danger); }
.row-actions { display: flex; gap: 5px; }
.mini { border: 1px solid var(--border); background: var(--card); border-radius: 7px; padding: 3px 7px; font-size: 13px; }
.mini.danger { color: var(--danger); }
.btn-primary { background: var(--primary); color: #fff; border: none; border-radius: 9px; padding: 9px 16px; font-size: 14px; font-weight: 600; }
.btn-primary:disabled { opacity: .6; }
.btn-ghost { border: 1px solid var(--border); background: var(--card); border-radius: 9px; padding: 9px 16px; font-size: 14px; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: var(--card); border-radius: 16px; padding: 20px; width: 90%; max-width: 420px; max-height: 88vh; overflow: auto; }
.modal.wide { max-width: 620px; }
.modal h3 { margin-bottom: 6px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.allergen-pick { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.allergen-pick .chip { border: 1px solid var(--border); background: var(--card); border-radius: 20px; padding: 5px 11px; font-size: 12px; color: var(--muted); }
.allergen-pick .chip.sel { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
.inline-check { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; color: var(--text); }
.loading { color: var(--muted); }
.sec-title { margin-top: 24px; }
.theme-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
.theme-card {
  border: 2px solid var(--border); border-radius: 14px; padding: 12px;
  cursor: pointer; text-align: center; transition: all .2s ease; background: var(--card);
}
.theme-card.sel { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-soft); }
.theme-swatch {
  height: 64px; border-radius: 10px; margin-bottom: 8px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
}
.theme-swatch[data-th="business"] { background: #f5f7fa; }
.theme-swatch[data-th="cafe"] { background: #f3ecdf; }
.theme-swatch[data-th="cozy"] { background: #fff5ee; }
.theme-swatch .sw-logo { font-size: 20px; }
.theme-swatch .sw-line { width: 50%; height: 6px; border-radius: 3px; }
.theme-swatch[data-th="business"] .sw-line { background: #2f6fed; }
.theme-swatch[data-th="cafe"] .sw-line { background: #6f4e37; }
.theme-swatch[data-th="cozy"] .sw-line { background: #ff8a5c; }
.theme-swatch .sw-line.short { width: 32%; opacity: .4; }
.theme-name { font-weight: 700; font-size: 14px; }
.theme-desc { font-size: 11px; color: var(--muted); margin-top: 2px; }
@media (max-width: 640px) { .theme-row { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }
</style>