// ============================================================
// 本地数据库封装 (IndexedDB via idb)
// 本地优先架构的存储地基。所有业务数据落在这里。
// 结构设计为"可增量同步"：
//   - 每条记录带 updated_at（同步增量比对）
//   - 每条记录带 checksum（完整性/防篡改）
//   - 提供本地查询/写入统一接口，未来同步引擎在此之上。
// ============================================================

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { newId } from './id'
import { withChecksum } from './checksum'

// ---- 表清单 ----
export const DB_NAME = 'dasanjiang-pos'
export const DB_VERSION = 1

export interface DbRecord {
  id: string
  created_at: number
  updated_at: number
  checksum?: string
  [key: string]: unknown
}

interface PosDB extends DBSchema {
  // 商家/店铺配置
  stores: { key: string; value: DbRecord }
  // 商品（菜品）
  products: { key: string; value: DbRecord; indexes: { 'by-cat': string } }
  // 分类
  categories: { key: string; value: DbRecord }
  // 税率
  tax_rates: { key: string; value: DbRecord }
  // 订单
  orders: { key: string; value: DbRecord; indexes: { 'by-created': number } }
  // 打印机关联配置
  printers: { key: string; value: DbRecord }
  // 同步断点/状态
  sync_state: { key: string; value: DbRecord }
  // 设置（key-value）
  settings: { key: string; value: DbRecord }
}

let dbPromise: Promise<IDBPDatabase<PosDB>> | null = null

export function getDb(): Promise<IDBPDatabase<PosDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PosDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('stores')) db.createObjectStore('stores', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('products')) {
          const s = db.createObjectStore('products', { keyPath: 'id' })
          s.createIndex('by-cat', 'cat')
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('tax_rates')) db.createObjectStore('tax_rates', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('orders')) {
          const s = db.createObjectStore('orders', { keyPath: 'id' })
          s.createIndex('by-created', 'created_at')
        }
        if (!db.objectStoreNames.contains('printers')) db.createObjectStore('printers', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('sync_state')) db.createObjectStore('sync_state', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

/** 写入（插入或覆盖）一条记录，自动补 created_at/updated_at/checksum */
export async function putRow<T extends DbRecord>(
  store: StoreName,
  data: Partial<Omit<T, 'id'>> & { id?: string },
): Promise<T> {
  const db = await getDb()
  const now = Date.now()
  const rec = {
    ...data,
    id: data.id ?? newId(),
    created_at: (data as any).created_at ?? now,
    updated_at: now,
  } as unknown as T & Record<string, unknown>
  const withCs = withChecksum(rec as Record<string, unknown>)
  await db.put(store as any, withCs as any)
  return withCs as unknown as T
}

/** 批量写入 */
export async function putMany<T extends DbRecord>(store: StoreName, rows: T[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(store as any, 'readwrite')
  for (const r of rows) {
    const withCs = withChecksum({ ...r, updated_at: Date.now() } as Record<string, unknown>)
    await tx.store.put(withCs as any)
  }
  await tx.done
}

/** 按 id 获取 */
export async function getRow<T extends DbRecord>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await getDb()
  return (await db.get(store as any, id)) as T | undefined
}

/** 获取某表全部记录 */
export async function getAll<T extends DbRecord>(store: StoreName): Promise<T[]> {
  const db = await getDb()
  return (await db.getAll(store as any)) as T[]
}

/** 删除记录 */
export async function deleteRow(store: StoreName, id: string): Promise<void> {
  const db = await getDb()
  await db.delete(store as any, id)
}

/** 清空某表 */
export async function clearStore(store: StoreName): Promise<void> {
  const db = await getDb()
  await db.clear(store as any)
}

/** 通过索引取记录 */
export async function getByIndex<T extends DbRecord>(
  store: StoreName,
  index: string,
  value: unknown,
): Promise<T[]> {
  const db = await getDb()
  const tx = db.transaction(store as any) as any
  return (await tx.store.index(index).getAll(value)) as T[]
}

/** 最近 N 条（按 updated_at 或 created_at 倒序） */
export async function getRecent<T extends DbRecord>(
  store: StoreName,
  index: string,
  limit = 50,
): Promise<T[]> {
  const db = await getDb()
  const tx = db.transaction(store as any) as any
  let cursor = await tx.store.index(index).openCursor(null, 'prev')
  const out: T[] = []
  while (cursor && out.length < limit) {
    out.push(cursor.value as T)
    cursor = await cursor.continue()
  }
  return out
}

/** 迁移到 next-offset 的增量记录：updated_at > lastSync */
export async function getDelta<T extends DbRecord>(
  store: StoreName,
  lastSync: number,
): Promise<T[]> {
  const db = await getDb()
  const all = (await db.getAll(store as any)) as T[]
  return all.filter((r) => (r.updated_at || 0) > lastSync)
}

export type StoreName = 'stores' | 'products' | 'categories' | 'tax_rates' | 'orders' | 'printers' | 'sync_state' | 'settings'