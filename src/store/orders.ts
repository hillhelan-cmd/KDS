// ============================================================
// Pinia store: orders —— 订单（下单/流水号/持久化到 IndexedDB）
// 含：每日流水号（seq，当日从1开始）、来源、金额拆分(会计口径)
// 与同步字段（本地优先：先写本地库，M2 起再异步上云）
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAll, putRow, getRow } from '../core/db'
import type { Order, OrderItem, SourceKey, Product } from '../models/types'
import { splitTax } from '../data/taxRates'

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const loaded = ref(false)

  /** 每日流水号：同一天自增，跨天重置 */
  function nextSeq(): number {
    const today = new Date().toDateString()
    let lastSeq = 0
    // 从现有今日订单里取最大 seq
    const todayOrders = orders.value.filter((o) => new Date(o.created_at).toDateString() === today)
    if (todayOrders.length) {
      lastSeq = Math.max(...todayOrders.map((o) => o.seq || 0))
    }
    return lastSeq + 1
  }

  async function load() {
    orders.value = await getAll<Order>('orders')
    orders.value.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    loaded.value = true
  }

  /**
   * 创建订单（本地优先，立即落库）
   * @param items  已算好单价的条目
   * @param opts   订单信息
   */
  async function createOrder(opts: {
    source: SourceKey
    dine_type: Order['dine_type']
    items: { product: Product; qty: number; unitGross: number; taxRate: number; name: string }[]
    table_no?: string
    address?: string
    phone?: string
    delivery_fee?: number
    remark?: string
    payment_method?: string
  }): Promise<Order> {
    // 计算条目（含税单价拆净额/税额）
    const orderItems: OrderItem[] = []
    let subtotal = 0
    let taxTotal = 0
    const breakdownMap = new Map<number, { taxable: number; tax: number }>()

    for (const it of opts.items) {
      const gross = Math.round(it.unitGross * it.qty * 100) / 100
      const { taxable, tax } = splitTax(gross, it.taxRate)
      subtotal += taxable
      taxTotal += tax
      const b = breakdownMap.get(it.taxRate) || { taxable: 0, tax: 0 }
      b.taxable += taxable
      b.tax += tax
      breakdownMap.set(it.taxRate, b)
      orderItems.push({ product_id: it.product.id, name: it.name, qty: it.qty, unit_price: it.unitGross, tax_rate: it.taxRate })
    }

    const delivery = opts.delivery_fee || 0
    const subtotalRound = Math.round(subtotal * 100) / 100
    const taxTotalRound = Math.round(taxTotal * 100) / 100
    const grandTotal = Math.round((subtotalRound + taxTotalRound + delivery) * 100) / 100
    const taxBreakdown = Array.from(breakdownMap.entries()).map(([rate, v]) => ({
      rate, taxable: Math.round(v.taxable * 100) / 100, tax: Math.round(v.tax * 100) / 100,
    }))

    const seq = nextSeq()
    const order: Partial<Order> & { dine_type: Order['dine_type'] } = {
      seq,
      source: opts.source,
      dine_type: opts.dine_type,
      table_no: opts.table_no,
      address: opts.address,
      phone: opts.phone,
      delivery_fee: delivery,
      status: 'new',
      payment_status: 'pending',
      payment_method: opts.payment_method,
      manual: opts.source === 'web' ? false : undefined,
      subtotal: subtotalRound,
      tax_total: taxTotalRound,
      net_total: Math.round((grandTotal - taxTotalRound) * 100) / 100,
      grand_total: grandTotal,
      tax_breakdown: taxBreakdown,
      items: orderItems,
      remark: opts.remark,
    }
    const saved = await putRow<Order>('orders', order as any)
    orders.value.unshift(saved)
    return saved
  }

  /** 更新订单状态 */
  async function updateStatus(id: string, status: Order['status']) {
    const o = orders.value.find((x) => x.id === id)
    if (!o) return o
    o.status = status
    await putRow<Order>('orders', o as any)
    return o
  }

  async function getById(id: string): Promise<Order | undefined> {
    return getRow<Order>('orders', id) ?? orders.value.find((o) => o.id === id)
  }

  /** 今日订单 */
  const todayOrders = computed(() => {
    const today = new Date().toDateString()
    return orders.value.filter((o) => new Date(o.created_at).toDateString() === today)
  })

  return {
    orders, loaded, todayOrders,
    load, createOrder, updateStatus, getById, nextSeq,
  }
})