// ============================================================
// 过敏源过滤引擎 (Allergen Filter Engine)
// 需求：
//   1. 菜品带 allergens 数组（如 ['nuts','gluten','dairy']）
//   2. 顾客选过敏标签后，渲染菜单时动态过滤：匹配项设为"禁用"并加提示，
//      非匹配项正常显示
//   3. 前端即时响应，支持多标签组合过滤
// 本模块只做纯逻辑（输入菜品+所选标签 → 输出该菜是否禁用及原因），
// UI 层据此渲染（变灰/锁图标/点击提示）。保证逻辑可单测、跨端一致。
// ============================================================

import type { Product } from '../models/types'

/** 内置常见过敏源标签（荷兰/欧盟通用，可扩展） */
export const ALLERGEN_TAGS = [
  { key: 'gluten',     label: { zh: '麸质', en: 'Gluten', nl: 'Gluten' }, icon: '🌾' },
  { key: 'dairy',      label: { zh: '乳制品', en: 'Dairy', nl: 'Zuivel' }, icon: '🥛' },
  { key: 'eggs',       label: { zh: '蛋', en: 'Eggs', nl: 'Eieren' }, icon: '🥚' },
  { key: 'nuts',       label: { zh: '坚果', en: 'Nuts', nl: 'Noten' }, icon: '🥜' },
  { key: 'peanuts',    label: { zh: '花生', en: 'Peanuts', nl: 'Pinda' }, icon: '🥜' },
  { key: 'soy',        label: { zh: '大豆', en: 'Soy', nl: 'Soja' }, icon: '🫘' },
  { key: 'sesame',     label: { zh: '芝麻', en: 'Sesame', nl: 'Sesam' }, icon: '🫙' },
  { key: 'shellfish',  label: { zh: '甲壳类', en: 'Shellfish', nl: 'Schaaldieren' }, icon: '🦐' },
  { key: 'fish',       label: { zh: '鱼', en: 'Fish', nl: 'Vis' }, icon: '🐟' },
  { key: 'celery',     label: { zh: '芹菜', en: 'Celery', nl: 'Selderij' }, icon: '🥬' },
  { key: 'mustard',    label: { zh: '芥末', en: 'Mustard', nl: 'Mosterd' }, icon: '🟡' },
  { key: 'sulphites',  label: { zh: '亚硫酸盐', en: 'Sulphites', nl: 'Sulfiet' }, icon: '⚗️' },
  { key: 'lupin',      label: { zh: '羽扇豆', en: 'Lupin', nl: 'Lupine' }, icon: '🫛' },
  { key: 'molluscs',   label: { zh: '软体动物', en: 'Molluscs', nl: 'Weekdieren' }, icon: '🐚' },
]

export type AllergenKey = string

export interface AllergenFilterResult {
  product: Product
  /** 该菜品是否应被禁用（含任一选中过敏原） */
  disabled: boolean
  /** 命中的过敏原 key 列表 */
  matched: AllergenKey[]
}

/**
 * 核心过滤：输入菜品列表 + 选中的过敏标签集合，
 * 返回每道菜是否禁用及命中原因。
 * 多标签 = 交集外的任一命中即禁用（任一过敏原包含即不可食）。
 */
export function filterByAllergens(
  products: Product[],
  selected: Set<AllergenKey>,
): AllergenFilterResult[] {
  if (!selected || selected.size === 0) {
    return products.map((p) => ({ product: p, disabled: false, matched: [] }))
  }
  return products.map((p) => {
    const allergens = p.allergens || []
    const matched = allergens.filter((a) => selected.has(a))
    return { product: p, disabled: matched.length > 0, matched }
  })
}

/** 某菜是否命中指定单个过敏标签 */
export function hasAllergen(product: Product, tag: AllergenKey): boolean {
  return !!(product.allergens && product.allergens.includes(tag))
}

/** 根据过敏标签 key 取显示名（某语言下） */
export function allergenLabel(key: AllergenKey, lang: string): string {
  const t = ALLERGEN_TAGS.find((a) => a.key === key)
  if (!t) return key
  return t.label[lang as 'zh' | 'en' | 'nl'] || key
}