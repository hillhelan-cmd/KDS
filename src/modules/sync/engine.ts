// ============================================================
// 同步引擎 (Sync Engine)
// 把 Local-First 的增量数据推送到 Cloudflare Worker(D1)，并拉回云端增量。
// 由 store 在写操作后 + 启动时 + 网络恢复时触发。
//
// 流程：
//   1. 从每个业务表取 getDelta(updated_at > lastSyncAt)
//   2. CloudflareSyncAdapter.sync() 上推 + 拉回
//   3. 把拉回的数据 putMany 写回本地（跳过本地更新的行）
//   4. 更新 sync_state 断点
// ============================================================

import { getDelta, putMany, getRow, putRow, type StoreName } from '../../core/db'
import { deviceId } from '../../core/id'
import { getSyncAdapter, type SyncResult } from './adapter'

/** 参与云同步的业务表（不含 sync_state 自身） */
export const SYNC_STORES: { store: StoreName; enabled: boolean }[] = [
  { store: 'stores', enabled: true },
  { store: 'products', enabled: true },
  { store: 'categories', enabled: true },
  { store: 'tax_rates', enabled: true },
  { store: 'orders', enabled: true },
  { store: 'printers', enabled: true },
  { store: 'settings', enabled: false }, // settings 本地为主，暂不同步
]

const SYNC_STATE_ID = 'main'

/** 读取上次同步断点 */
export async function getLastSyncAt(): Promise<number> {
  const row = await getRow('sync_state', SYNC_STATE_ID)
  return (row && (row as any).last_sync_at) || 0
}

async function setLastSyncAt(ts: number): Promise<void> {
  await putRow('sync_state', { id: SYNC_STATE_ID, last_sync_at: ts } as any)
}

let syncing = false

/**
 * 执行一轮增量同步（上推 + 下拉）。
 * 幂等、串行（同刻只跑一轮），失败静默返回 success:false（由调用方决定是否提示）。
 */
export async function runSyncEngine(): Promise<SyncResult> {
  if (syncing) return { success: false, pulled: {}, server_time: Date.now(), error: 'already_syncing' }
  syncing = true
  try {
    const lastSyncAt = await getLastSyncAt()

    // 1) 收集增量（每个表 updated_at > lastSyncAt）
    const pushed: Record<string, any[]> = {}
    for (const { store, enabled } of SYNC_STORES) {
      if (!enabled) continue
      const delta = await getDelta(store, lastSyncAt)
      if (delta.length > 0) pushed[store] = delta
    }

    // 2) 上推 + 拉回
    const adapter = getSyncAdapter()
    const result = await adapter.sync({
      device_id: deviceId(),
      last_sync_at: lastSyncAt,
      pushed,
    })

    if (result.success) {
      // 3) 把拉回的云端数据写回本地（按 updated_at 保留最新）
      for (const [store, rowsRaw] of Object.entries(result.pulled)) {
        const rows = rowsRaw as any[]
        if (rows.length === 0) continue
        const local = await getDelta(store as StoreName, 0)
        const localById = new Map(local.map((r) => [r.id, r]))
        const merged = rows.map((cloud: any) => {
          const loc = localById.get(cloud.id)
          // 云端比本地新才覆盖；否则保留本地（以晚上传/下次合并）
          if (loc && (loc.updated_at || 0) > (cloud.updated_at || 0)) return loc
          return cloud
        })
        await putMany(store as StoreName, merged as any)
      }

      // 4) 更新断点（用服务器时间，避免设备时钟偏移）
      const newTs = result.server_time || Date.now()
      await setLastSyncAt(newTs)
    }

    return result
  } catch (e) {
    console.error('[sync] engine error:', e)
    return { success: false, pulled: {}, server_time: Date.now(), error: e instanceof Error ? e.message : String(e) }
  } finally {
    syncing = false
  }
}

/**
 * 启动时调用：初始化 Cloudflare adapter + 首次全量拉到本地。
 * 失败（如未部署/离线）不阻塞业务。
 */
export async function initCloudSync(): Promise<void> {
  try {
    const adapter = getSyncAdapter()
    if ((adapter as any).init) await (adapter as any).init()
    await runSyncEngine()
  } catch (e) {
    console.warn('[sync] init failed (offline?):', e)
  }
}