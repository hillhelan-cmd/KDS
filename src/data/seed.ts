// ============================================================
// 种子数据 (M1) —— 首次运行时初始化本地库
// 写入：默认商家、默认税率、默认分类、示例菜单（可被后台编辑覆盖）
// 用 idb 的 put 幂等（若已存在则跳过/覆盖）
// ============================================================

import { getDb } from '../core/db'
import { newId } from '../core/id'
import { withChecksum } from '../core/checksum'
import type { Store, TaxRate, Category, Product } from '../models/types'
import { TAX_SETS } from '../data/taxRates'

let seededFlag = 'pos_seeded_v1'

/** 是否已初始化 */
export function isSeeded(): boolean {
  try { return !!localStorage.getItem(seededFlag) } catch { return false }
}

export function markSeeded() {
  try { localStorage.setItem(seededFlag, '1') } catch { /* ignore */ }
}

function baseRec() {
  const now = Date.now()
  return { created_at: now, updated_at: now }
}

/** 初始商家 */
export function defaultStore(): Store {
  const r = withChecksum({ ...baseRec(), id: 'store_default', name: zhName, tagline: '达三江 · 点餐系统' })
  return r as unknown as Store
}

const zhName = '达三江'

/** 初始税率 */
export function seedTaxRates(): TaxRate[] {
  return TAX_SETS.map((t) => withChecksum({ ...baseRec(), id: newId(), name: t.name.zh, rate: t.rate })) as unknown as TaxRate[]
}

/** 初始分类（对应原生 4 类） */
export function seedCategories(): Category[] {
  const defs: { id: string; name: Record<string, string>; icon: string }[] = [
    { id: 'setmeal',    name: { zh: '套餐', en: 'Set Meal', nl: 'Menu' }, icon: '🍱' },
    { id: 'staple',     name: { zh: '主食', en: 'Staple Food', nl: 'Hoofdgerecht' }, icon: '🍚' },
    { id: 'dimsum',     name: { zh: '小点心', en: 'Dim Sum', nl: 'Hapjes' }, icon: '🥟' },
    { id: 'drinks',     name: { zh: '饮料', en: 'Drinks', nl: 'Dranken' }, icon: '🥤' },
  ]
  return defs.map((d, i) => withChecksum({ ...baseRec(), id: d.id, name: d.name, icon: d.icon, sort: i }) as unknown as Category)
}

/** 示例菜单（带过敏源字段，演示过滤引擎） */
export function seedProducts(taxRateId: string): Product[] {
  const defs: Omit<Product, keyof ReturnType<typeof baseRec>>[] = [
    { id: 'p1', name: { zh: '宫保鸡丁', en: 'Kung Pao Chicken', nl: 'Kung Pao Kip' }, price: 12.5, tax_rate_id: taxRateId, cat: 'staple', img: '🍛', allergens: ['peanuts', 'gluten'], alrg: '含花生/麸质' },
    { id: 'p2', name: { zh: '麻婆豆腐', en: 'Mapo Tofu', nl: 'Mapo Tofu' }, price: 11.0, tax_rate_id: taxRateId, cat: 'staple', img: '🍲', allergens: ['soy', 'gluten'], alrg: '含大豆/麸质' },
    { id: 'p3', name: { zh: '虾饺', en: 'Har Gow', nl: 'Har Gow' }, price: 6.5, tax_rate_id: taxRateId, cat: 'dimsum', img: '🥟', allergens: ['shellfish', 'gluten'], alrg: '含虾/麸质' },
    { id: 'p4', name: { zh: '春卷', en: 'Spring Rolls', nl: 'Loempia' }, price: 5.0, tax_rate_id: taxRateId, cat: 'dimsum', img: '🌯', allergens: ['gluten'], alrg: '含麸质' },
    { id: 'p5', name: { zh: '蔬菜炒面', en: 'Vegetable Chow Mein', nl: 'Groente Bami' }, price: 9.5, tax_rate_id: taxRateId, cat: 'setmeal', img: '🍜', allergens: ['gluten', 'soy'], alrg: '含麸质/大豆' },
    { id: 'p6', name: { zh: '茉莉花茶', en: 'Jasmine Tea', nl: 'Jasmijn thee' }, price: 3.0, tax_rate_id: taxRateId, cat: 'drinks', img: '🍵', allergens: [], alrg: '' },
    { id: 'p7', name: { zh: '珍珠奶茶', en: 'Bubble Tea', nl: 'Bubble tea' }, price: 5.5, tax_rate_id: taxRateId, cat: 'drinks', img: '🧋', allergens: ['dairy', 'soy'], alrg: '含乳制品/大豆' },
  ]
  return defs.map((d) => withChecksum({ ...baseRec(), ...d, sort: 0 }) as unknown as Product)
}

/** 执行完整种子初始化 */
export async function seedAll(): Promise<void> {
  if (isSeeded()) return
  const db = await getDb()
  const tx = db.transaction(['stores', 'tax_rates', 'categories', 'products'], 'readwrite')
  // 商家
  await tx.objectStore('stores').put(defaultStore() as any)
  // 税率
  const taxes = seedTaxRates()
  for (const t of taxes) await tx.objectStore('tax_rates').put(t as any)
  // 分类
  for (const c of seedCategories()) await tx.objectStore('categories').put(c as any)
  // 菜单（用第一个税率 id）
  const taxId = taxes[0].id
  for (const p of seedProducts(taxId)) await tx.objectStore('products').put(p as any)
  await tx.done
  markSeeded()
}