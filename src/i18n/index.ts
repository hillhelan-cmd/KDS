// ============================================================
// i18n —— 轻量三语字典（中文 / English / Nederlands）
// 不引入 vue-i18n，用轻量响应式实现，够用且可控。
// 用法：t('menuTitle') ；t.xx 均按当前语言取。
// ============================================================

import { reactive, computed } from 'vue'
import type { Lang } from '../models/types'

type Dict = Record<string, string>

export const LANGUAGES: { key: Lang; native: string; flag: string }[] = [
  { key: 'zh', native: '中文', flag: '🇨🇳' },
  { key: 'en', native: 'English', flag: '🇬🇧' },
  { key: 'nl', native: 'Nederlands', flag: '🇳🇱' },
]

const zh: Dict = {
  appName: '达三江',
  tagline: '点餐系统',
  kioskMode: '自助机模式',
  // 点餐
  categories: '分类',
  allCategories: '全部',
  addToCart: '加入',
  soldout: '售罄',
  cart: '购物车',
  cartEmpty: '购物车是空的',
  total: '合计',
  confirmOrder: '确认订单',
  // 取餐方式
  dineType: '取餐方式',
  dinein: '堂食',
  takeaway: '自取',
  delivery: '外卖',
  tableNo: '桌号/取餐号',
  address: '配送地址',
  phone: '联系电话',
  deliveryFee: '配送费',
  remark: '备注',
  submitOrder: '下单',
  orderOk: '下单成功！取餐号',
  // 过敏源
  allergenFilter: '过敏源过滤',
  allergenFilterHint: '勾选过敏原，相关菜品将自动禁用',
  containsAllergen: '本菜品含有过敏原',
  // 订单来源
  source: '来源',
  manualEntry: '手动录入',
  // 打印机
  printer: '打印机',
  printerOffline: '打印机连接中...',
  // 状态
  online: '在线',
  offline: '离线',
  admin: '后台管理',
  yes: '确定',
  no: '取消',
}

const en: Dict = {
  appName: 'Dasanjiang',
  tagline: 'Ordering System',
  kioskMode: 'Kiosk Mode',
  categories: 'Categories',
  allCategories: 'All',
  addToCart: 'Add',
  soldout: 'Sold out',
  cart: 'Cart',
  cartEmpty: 'Your cart is empty',
  total: 'Total',
  confirmOrder: 'Confirm Order',
  dineType: 'Dine type',
  dinein: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
  tableNo: 'Table/No.',
  address: 'Address',
  phone: 'Phone',
  deliveryFee: 'Delivery fee',
  remark: 'Note',
  submitOrder: 'Place Order',
  orderOk: 'Order placed! Pickup No.',
  allergenFilter: 'Allergen Filter',
  allergenFilterHint: 'Select allergens to auto-disable matching dishes',
  containsAllergen: 'This dish contains allergens',
  source: 'Source',
  manualEntry: 'Manual entry',
  printer: 'Printer',
  printerOffline: 'Connecting to printer...',
  online: 'Online',
  offline: 'Offline',
  admin: 'Admin',
  yes: 'OK',
  no: 'Cancel',
}

const nl: Dict = {
  appName: 'Dasanjiang',
  tagline: 'Bestelsysteem',
  kioskMode: 'Kioskmodus',
  categories: 'Categorieën',
  allCategories: 'Alles',
  addToCart: 'Toevoegen',
  soldout: 'Uitverkocht',
  cart: 'Winkelwagen',
  cartEmpty: 'Uw winkelwagen is leeg',
  total: 'Totaal',
  confirmOrder: 'Bevestig Bestelling',
  dineType: 'Eettype',
  dinein: 'Ter plaatse',
  takeaway: 'Meenemen',
  delivery: 'Bezorging',
  tableNo: 'Tafel/Nr.',
  address: 'Adres',
  phone: 'Telefoon',
  deliveryFee: 'Bezorgkosten',
  remark: 'Opmerking',
  submitOrder: 'Plaats Bestelling',
  orderOk: 'Bestelling geplaatst! Afhaalnr.',
  allergenFilter: 'Allergeenfilter',
  allergenFilterHint: 'Selecteer allergenen om gerechten uit te schakelen',
  containsAllergen: 'Dit gerecht bevat allergenen',
  source: 'Bron',
  manualEntry: 'Handmatig',
  printer: 'Printer',
  printerOffline: 'Verbinden met printer...',
  online: 'Online',
  offline: 'Offline',
  admin: 'Admin',
  yes: 'OK',
  no: 'Annuleren',
}

const dicts: Record<Lang, Dict> = { zh, en, nl }

/** 当前语言（响应式） */
export const lang = reactive({ value: loadLang() })

function loadLang(): Lang {
  const saved = localStorage.getItem('pos_lang') as Lang | null
  if (saved && LANGUAGES.some((l) => l.key === saved)) return saved
  return 'zh'
}

export function setLang(l: Lang) {
  lang.value = l
  try { localStorage.setItem('pos_lang', l) } catch { /* ignore */ }
}

/** 翻译函数：t('key') */
export function t(key: string): string {
  const d = dicts[lang.value] || zh
  return d[key] ?? zh[key] ?? key
}

/** 翻译多语言字段对象 {zh,en,nl} */
export function tl(obj: Record<Lang, string> | undefined, fallback = ''): string {
  if (!obj) return fallback
  return obj[lang.value] ?? obj.zh ?? obj.en ?? obj.nl ?? fallback
}

/** 响应式翻译 hook（组件内用） */
export function useT() {
  return computed(() => ({
    value: t,
    tl,
    lang: lang.value,
  }))
}