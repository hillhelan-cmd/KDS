// ============================================================
// Pinia store: menu —— 菜单/分类/税率/过敏源过滤状态
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAll, getRow, putRow, deleteRow } from '../core/db'
import { seedAll } from '../data/seed'
import type { Product, Category, TaxRate } from '../models/types'
import { filterByAllergens, type AllergenKey, type AllergenFilterResult } from '../modules/allergen'
import { newId } from '../core/id'

// 异步触发云同步（不阻塞写操作，失败静默）
function fireSync() {
  import('../modules/sync/engine').then(({ runSyncEngine }) => runSyncEngine()).catch(() => {})
}

export const useMenuStore = defineStore('menu', () => {
  const products = ref<Product[]>([])
  const categories = ref<Category[]>([])
  const taxRates = ref<TaxRate[]>([])
  const loaded = ref(false)

  /** 顾客选中的过敏标签（为空=不过滤） */
  const selectedAllergens = ref<Set<AllergenKey>>(new Set())
  const allergenActive = computed(() => selectedAllergens.value.size > 0)

  /** 加载全量菜单数据（启动时调用） */
  async function load() {
    await seedAll()
    products.value = await getAll<Product>('products')
    categories.value = await getAll<Category>('categories')
    taxRates.value = await getAll<TaxRate>('tax_rates')
    loaded.value = true
  }

  /** 增加/移除过敏标签 */
  function toggleAllergen(a: AllergenKey) {
    const s = new Set(selectedAllergens.value)
    if (s.has(a)) s.delete(a)
    else s.add(a)
    selectedAllergens.value = s
  }
  function clearAllergens() {
    selectedAllergens.value = new Set()
  }

  /** 应用过敏源过滤后的菜品列表（含禁用标记） */
  const filteredProducts = computed<AllergenFilterResult[]>(() => {
    return filterByAllergens(products.value, selectedAllergens.value)
  })

  /** 很简单：某分类下的菜品（含过敏源状态） */
  function byCategory(catId: string): AllergenFilterResult[] {
    return filteredProducts.value.filter((r) => (r.product.cat || '') === catId)
  }

  /** 获取某菜（原始，不过滤） */
  async function getProduct(id: string): Promise<Product | undefined> {
    return getRow<Product>('products', id) ?? products.value.find((p) => p.id === id)
  }

  function categoryName(c: Category | undefined): string {
    if (!c) return ''
    return c.name && (c.name as any)[(localStorage.getItem('pos_lang') || 'zh')] || c.name?.zh || ''
  }

  // ============ M2 后台管理：增删改 ============

  /** 新增菜品 */
  async function addProduct(data: Partial<Product>): Promise<Product> {
    const p = await putRow<Product>('products', {
      ...data,
      id: data.id ?? newId(),
      name: data.name ?? { zh: '', en: '', nl: '' },
      price: data.price ?? 0,
      tax_rate_id: data.tax_rate_id || taxRates.value[0]?.id || '',
      allergens: data.allergens ?? [],
      sort: data.sort ?? 999,
    })
    products.value = await getAll<Product>('products')
    fireSync()
    return p
  }

  /** 更新菜品 */
  async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
    const cur = products.value.find((p) => p.id === id)
    if (!cur) return
    await putRow<Product>('products', { ...cur, ...data, id })
    products.value = await getAll<Product>('products')
    fireSync()
  }

  /** 删除菜品 */
  async function deleteProduct(id: string): Promise<void> {
    await deleteRow('products', id)
    products.value = await getAll<Product>('products')
    fireSync()
  }

  // ---- 分类 ----
  async function addCategory(data: Partial<Category>): Promise<Category> {
    const c = await putRow<Category>('categories', {
      ...data,
      id: data.id ?? newId(),
      name: data.name ?? { zh: '', en: '', nl: '' },
      sort: data.sort ?? 999,
    })
    categories.value = await getAll<Category>('categories')
    fireSync()
    return c
  }
  async function updateCategory(id: string, data: Partial<Category>): Promise<void> {
    const cur = categories.value.find((c) => c.id === id)
    if (!cur) return
    await putRow<Category>('categories', { ...cur, ...data, id })
    categories.value = await getAll<Category>('categories')
    fireSync()
  }
  async function deleteCategory(id: string): Promise<void> {
    await deleteRow('categories', id)
    categories.value = await getAll<Category>('categories')
    fireSync()
  }

  // ---- 税率 ----
  async function addTaxRate(data: Partial<TaxRate>): Promise<TaxRate> {
    const t = await putRow<TaxRate>('tax_rates', {
      ...data,
      id: data.id ?? newId(),
      name: data.name ?? '',
      rate: data.rate ?? 0,
    })
    taxRates.value = await getAll<TaxRate>('tax_rates')
    fireSync()
    return t
  }
  async function updateTaxRate(id: string, data: Partial<TaxRate>): Promise<void> {
    const cur = taxRates.value.find((t) => t.id === id)
    if (!cur) return
    await putRow<TaxRate>('tax_rates', { ...cur, ...data, id })
    taxRates.value = await getAll<TaxRate>('tax_rates')
    fireSync()
  }
  async function deleteTaxRate(id: string): Promise<void> {
    await deleteRow('tax_rates', id)
    taxRates.value = await getAll<TaxRate>('tax_rates')
    fireSync()
  }

  return {
    products, categories, taxRates, loaded,
    selectedAllergens, allergenActive,
    load, toggleAllergen, clearAllergens,
    filteredProducts, byCategory, getProduct, categoryName,
    addProduct, updateProduct, deleteProduct,
    addCategory, updateCategory, deleteCategory,
    addTaxRate, updateTaxRate, deleteTaxRate,
  }
})