// ============================================================
// 数据模型 (M1)：所有业务实体的类型定义
// 每个实体继承 DbRecord（id/created_at/updated_at/checksum）
// 这里同时预留了"商用升级字段"（license、payment 等），
// 现在用不上，但架构里立好，以后填实现不重打地基。
// ============================================================

import type { DbRecord } from '../core/db'

// ---- 店铺 / 商家 ----
export type ThemeKey = 'business' | 'cafe' | 'cozy'

export interface Store extends DbRecord {
  name: string          // 店铺名
  tagline?: string
  address?: string
  vat_no?: string       // 税号
  phone?: string
  theme?: ThemeKey      // 全局主题（店主在后台切换，顾客端只应用）
  // 预留：授权
  license_key?: string  // License 校验入口（预留，M1 不校验）
  licensed?: boolean    // 是否已授权
}

// ---- 税率（增值税 BTW） ----
export interface TaxRate extends DbRecord {
  name: string          // 如 '食品 9%'、'标准 21%'、'烈酒 45%'
  rate: number          // 0.09 / 0.21 / 0.45
  default?: boolean
}

// ---- 分类 ----
export interface Category extends DbRecord {
  name: Record<string, string> // 多语言 {zh,en,nl}
  sort: number
  icon?: string
}

// ---- 商品（菜品）----
export interface ProductOpt {
  id: string
  name: Record<string, string>
  // multiselect: 允许多选（如加料）；single: 单选属性（如辣度/温度）
  type: 'single' | 'multi'
  options: { id: string; name: Record<string, string>; delta: number }[]
}

export interface Product extends DbRecord {
  name: Record<string, string>
  desc?: Record<string, string>
  price: number
  tax_rate_id: string
  cat?: string          // 分类 id（或分类 key）
  img?: string          // emoji 或 url
  soldout?: boolean
  alrg?: string         // 过敏源文本提示（如 '含花生'）
  allergens: string[]   // 过敏源标签数组：['nuts','gluten','dairy'] —— 过敏源过滤引擎用地基字段
  opts?: ProductOpt[]   // 属性/加料选项
  sort?: number
}

// ---- 订单来源（可扩展表驱动）----
export type SourceKey = 'dinein' | 'takeaway' | 'web' | 'thuisbezorgd' | 'ubereats' | 'deliveroo' | 'wolt'

export interface OrderSource {
  key: SourceKey
  icon: string
  color: string
  name: Record<string, string>
  needsAddress: boolean // 外卖需配送地址/电话
  platform?: string     // 外部平台名
}

// ---- 订单 ----
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'completed' | 'refunded' | 'canceled'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'canceled' // 预留：支付状态机

export interface OrderItem {
  product_id: string
  name: string
  qty: number
  unit_price: number
  tax_rate: number
  opts?: { name: string; delta: number }[]
}

export interface Order extends DbRecord {
  seq: number                    // 每日流水号（1 开始，当日重置）
  source: SourceKey              // 订单来源
  // 三种取餐形式
  dine_type: 'dinein' | 'takeaway' | 'delivery'
  table_no?: string              // 堂食桌号 / 自取取餐号
  // 外卖配送
  address?: string
  phone?: string
  delivery_fee?: number
  // 状态
  status: OrderStatus
  payment_status: PaymentStatus  // 预留支付状态机
  payment_method?: string
  manual?: boolean               // 手动录入外卖
  platform?: string              // 外部平台名（来源为平台时）
  // 金额（会计口径：净/税/毛分开）
  subtotal: number               // 不含税小计
  tax_total: number              // 税额合计
  grand_total: number            // 含税总计
  net_total: number              // 净收入 = grand_total - tax_total
  tax_breakdown: { rate: number; taxable: number; tax: number }[]  // 税率拆解（会计用）
  items: OrderItem[]
  remark?: string
  created_by_device?: string     // 记录来源设备（同步用）
}

// ---- 打印机（局域网网络打印机）----
export type PrinterTaskTag = 'all' | 'dinein' | 'takeaway' | 'delivery' | 'kitchen' | 'receipt'

export interface PrinterConfig extends DbRecord {
  name: string
  ip: string
  port: number                    // 默认 9100 (ESC/POS)
  tags: PrinterTaskTag[]          // 任务标签：可勾选"全能"(all) 或特定类型，可多选，以后拆分
  enabled: boolean
  // 预留：驱动/协议
  protocol?: 'escpos-raw' | 'http' | 'ipp'
}

// ---- 店铺设置（key-value 也可）----
export interface Settings extends DbRecord {
  // 当前激活税率映射等由运行时维护
  delivery_fee?: number
  currency?: string // 默认 EUR
  kiosk_timeout?: number // 自助机空闲自动回首页秒数
}

// ---- 同步状态 ----
export interface SyncState extends DbRecord {
  last_sync_at: number
  device_id: string
  pending_push: number
  pending_pull: number
}

// 语言
export type Lang = 'zh' | 'en' | 'nl'

/** 多语言文本对象 */
export type I18nText = Record<Lang, string>