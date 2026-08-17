// ============================================================
// Pinia store: settings —— 店铺设置（含打印网关、配送费等）
// ============================================================

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRow, putRow } from '../core/db'
import type { Store } from '../models/types'

export const useSettingsStore = defineStore('settings', () => {
  const store = ref<Store | null>(null)
  const loaded = ref(false)

  async function load() {
    store.value = (await getRow<Store>('stores', 'store_default')) || null
    loaded.value = true
  }

  async function save(patch: Partial<Store>) {
    if (!store.value) {
      store.value = { id: 'store_default', name: '达三江', created_at: Date.now(), updated_at: Date.now() } as Store
    }
    const merged = { ...store.value, ...patch, updated_at: Date.now() }
    await putRow<Store>('stores', merged as any)
    store.value = merged
  }

  const storeName = (): string => store.value?.name || '达三江'

  return { store, loaded, load, save, storeName }
})