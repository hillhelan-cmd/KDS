// ============================================================
// 税率 (增值税 BTW) —— 多档税率，会计口径
// 荷兰餐饮常见：食品 9%，标准 21%，烈酒/烟草 45%
// ============================================================

import type { TaxRate } from '../models/types'
import { newId } from '../core/id'

export const TAX_SETS: { key: string; name: { zh: string; en: string; nl: string }; rate: number }[] = [
  { key: 'food9',  name: { zh: '食品 9%',  en: 'Food 9%',  nl: 'Voedsel 9%' },  rate: 0.09 },
  { key: 'std21',  name: { zh: '标准 21%', en: 'Standard 21%', nl: 'Standaard 21%' }, rate: 0.21 },
  { key: 'liquor45', name: { zh: '烈酒 45%', en: 'Liquor 45%', nl: 'Sterke drank 45%' }, rate: 0.45 },
]

/** 构造默认税率记录 */
export function defaultTaxRates(): TaxRate[] {
  const now = Date.now()
  return TAX_SETS.map((t) => ({
    id: newId(),
    created_at: now,
    updated_at: now,
    name: t.name.zh,
    rate: t.rate,
  }))
}

/**
 * 税额计算（会计口径）
 * 给定"含税单价 × 数量"总含税额 与 税率，拆出：净额(taxable)、税额(tax)。
 */
export function splitTax(gross: number, rate: number): { taxable: number; tax: number } {
  if (rate <= 0) return { taxable: gross, tax: 0 }
  // 净额 = 含税 / (1+rate)；税额 = 净额 * rate，两位小数舍入
  const taxable = Math.round((gross / (1 + rate)) * 100) / 100
  const tax = Math.round((taxable * rate) * 100) / 100
  return { taxable, tax }
}