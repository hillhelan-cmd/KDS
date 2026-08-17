// ============================================================
// Pinia store: cart —— 购物车
// 含：加菜/减菜/可选属性/金额计算（含税、税额按税率拆分）
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Product, ProductOpt } from '../models/types'
import { splitTax } from '../data/taxRates'

export interface CartLine {
  product: Product
  qty: number
  optSelections: { opt: ProductOpt; chosen: { id: string; name: string; delta: number }[] }[]
  unitGross: number  // 含税单价（基础价 + 选项加价）
}

export const useCartStore = defineStore('cart', () => {
  const lines = ref<CartLine[]>([])
  const selectedDineType = ref<'dinein' | 'takeaway' | 'delivery'>('dinein')
  const tableNo = ref('')
  const address = ref('')
  const phone = ref('')
  const remark = ref('')
  const deliveryFee = ref(0)

  function calcLineGross(p: Product, optSelections: CartLine['optSelections']): number {
    let g = p.price
    for (const sel of optSelections) {
      for (const c of sel.chosen) g += c.delta
    }
    return Math.round(g * 100) / 100
  }

  function findLine(productId: string, optKey: string): CartLine | undefined {
    return lines.value.find((l) => key(l) === optKey && l.product.id === productId)
  }
  function key(l: CartLine): string {
    return l.optSelections.map((s) => s.opt.id + ':' + s.chosen.map((c) => c.id).sort().join(',')).join('|')
  }

  function qty(p: Product, optSelections: CartLine['optSelections']): number {
    const l = lines.value.find((x) => x.product.id === p.id && x.optSelections === optSelections)
    return l ? l.qty : 0
  }

  function addItem(p: Product, optSelections: CartLine['optSelections'] = [], q = 1) {
    const unitGross = calcLineGross(p, optSelections)
    const existing = findLine(p.id, key({ product: p, qty: 0, optSelections, unitGross }))
    if (existing) {
      existing.qty += q
    } else {
      lines.value.push({ product: p, qty: q, optSelections, unitGross })
    }
  }

  function removeItem(p: Product, optSelections: CartLine['optSelections'] = [], q = 1) {
    const idx = lines.value.findIndex((l) => l.product.id === p.id && l.optSelections === optSelections)
    if (idx < 0) return
    lines.value[idx].qty -= q
    if (lines.value[idx].qty <= 0) lines.value.splice(idx, 1)
  }

  function changeQty(p: Product, optSelections: CartLine['optSelections'] = [], delta: number) {
    if (delta > 0) addItem(p, optSelections, delta)
    else removeItem(p, optSelections, -delta)
  }

  /** 本轮商品含税总额 */
  const subtotalGross = computed(() =>
    Math.round(lines.value.reduce((s, l) => s + l.unitGross * l.qty, 0) * 100) / 100,
  )
  /** 配送费 */
  const deliveryTotal = computed(() => (selectedDineType.value === 'delivery' ? deliveryFee.value : 0))
  /** 含税总计 */
  const grandTotal = computed(() => Math.round((subtotalGross.value + deliveryTotal.value) * 100) / 100)
  /** 税额（按各商品税率拆分汇总）+ 税率拆分明细(会计口径) */
  const taxTotal = computed(() => taxBreakdown.value.reduce((s, b) => s + b.tax, 0))
  const taxBreakdown = computed(() => {
    const map = new Map<number, { taxable: number; tax: number }>()
    for (const l of lines.value) {
      const gross = Math.round(l.unitGross * l.qty * 100) / 100
      const { taxable, tax } = splitTax(gross, taxRateResolver(l.product))
      const b = map.get(taxRateResolver(l.product)) || { taxable: 0, tax: 0 }
      b.taxable += taxable
      b.tax += tax
      map.set(taxRateResolver(l.product), b)
    }
    return Array.from(map.entries()).map(([rate, v]) => ({ rate, taxable: Math.round(v.taxable * 100) / 100, tax: Math.round(v.tax * 100) / 100 }))
  })
  /** 税率解析器：由菜单 store 注入（默认为 9% 食品档） */
  let taxRateResolver: (p: Product) => number = () => 0.09
  function configureTaxResolver(fn: (p: Product) => number) {
    taxRateResolver = fn
  }

  const lineCount = computed(() => lines.value.reduce((s, l) => s + l.qty, 0))
  const isEmpty = computed(() => lines.value.length === 0)

  function reset() {
    lines.value = []
    selectedDineType.value = 'dinein'
    tableNo.value = ''
    address.value = ''
    phone.value = ''
    remark.value = ''
    deliveryFee.value = 0
  }

  return {
    lines, selectedDineType, tableNo, address, phone, remark, deliveryFee,
    subtotalGross, deliveryTotal, grandTotal, taxTotal, taxBreakdown, lineCount, isEmpty,
    addItem, removeItem, changeQty, reset, qty, configureTaxResolver,
  }
})