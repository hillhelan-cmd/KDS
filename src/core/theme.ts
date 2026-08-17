// ============================================================
// 主题应用（M4 增强）：店铺主题全局生效
// 店主在后台管理切换 Store.theme，顾客端/自助机/后厨屏只应用。
// 通过 <html data-theme="..."> 切换 style.css 里的 3 套变量。
// ============================================================

import type { ThemeKey } from '../models/types'

export const THEMES: { key: ThemeKey; zh: string; en: string; desc: string }[] = [
  { key: 'business', zh: '简约商务', en: 'Business', desc: '清爽蓝灰 · 专业利落' },
  { key: 'cafe',     zh: '咖啡小馆', en: 'Café',     desc: '暖棕木质 · 复古格调' },
  { key: 'cozy',     zh: '温馨',     en: 'Cozy',     desc: '柔和暖色 · 居家亲切' },
]

/** 将主题写到 <html data-theme> */
export function applyTheme(theme?: ThemeKey) {
  const key: ThemeKey = theme && THEMES.some((t) => t.key === theme) ? theme : 'business'
  document.documentElement.dataset.theme = key
  try {
    localStorage.setItem('pos_theme', key)
  } catch { /* ignore */ }
}

/** 从本地读取上次主题（回退 business） */
export function getSavedTheme(): ThemeKey {
  try {
    const saved = localStorage.getItem('pos_theme') as ThemeKey | null
    if (saved && THEMES.some((t) => t.key === saved)) return saved
  } catch { /* ignore */ }
  return 'business'
}