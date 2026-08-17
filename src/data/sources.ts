// ============================================================
// 订单来源表 (Order Sources) —— 可扩展架构
// 这是"订单来源"的唯一数据源，驱动：图标/颜色/名称/是否需要配送地址。
// 以后新增外卖平台，只需在此数组加一项，订单列表/打印/徽标/对账全复用。
// ============================================================

import type { OrderSource, SourceKey } from '../models/types'

export const SOURCES: OrderSource[] = [
  { key: 'dinein',      icon: '🏠', color: '#27ae60', name: { zh: '堂食', en: 'Dine-in', nl: 'Ter plaatse' },      needsAddress: false, platform: '' },
  { key: 'takeaway',    icon: '🥡', color: '#f39c12', name: { zh: '自取', en: 'Takeaway', nl: 'Meenemen' },          needsAddress: false, platform: '' },
  { key: 'web',         icon: '🌐', color: '#0078D4', name: { zh: '本站外卖', en: 'Website', nl: 'Website' },         needsAddress: true,  platform: '' },
  { key: 'thuisbezorgd',icon: '🚲', color: '#d32f2f', name: { zh: 'Thuisbezorgd', en: 'Thuisbezorgd', nl: 'Thuisbezorgd' }, needsAddress: true, platform: 'Thuisbezorgd' },
  { key: 'ubereats',    icon: '🔵', color: '#06c167', name: { zh: 'Uber Eats', en: 'Uber Eats', nl: 'Uber Eats' },   needsAddress: true,  platform: 'Uber Eats' },
  { key: 'deliveroo',   icon: '🐢', color: '#00ccbc', name: { zh: 'Deliveroo', en: 'Deliveroo', nl: 'Deliveroo' },   needsAddress: true,  platform: 'Deliveroo' },
  { key: 'wolt',        icon: '💠', color: '#009de0', name: { zh: 'Wolt', en: 'Wolt', nl: 'Wolt' },                  needsAddress: true,  platform: 'Wolt' },
]

/** 按 key 取来源 */
export function getSource(key: SourceKey): OrderSource | undefined {
  return SOURCES.find((s) => s.key === key)
}

/** 来源在指定语言下的名称 */
export function sourceName(key: SourceKey, lang: string): string {
  const s = getSource(key)
  if (!s) return key
  return s.name[lang as 'zh' | 'en' | 'nl'] || key
}

/** 是否为外部外卖平台（非堂食/自取/本站） */
export function isExternalPlatform(key: SourceKey): boolean {
  const s = getSource(key)
  return !!s?.platform
}