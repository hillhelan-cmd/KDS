// ============================================================
// Cloudflare 同步适配器 (CloudflareSyncAdapter)
// 实现 ISyncAdapter，对接 Worker 后端 (pos-sync-api.workers.dev)。
// 职责：
//   - 将本地增量(pushed) POST 到 Worker /sync，写入 D1
//   - 从 Worker 拉回云端增量(pulled)，写回本地
// 与 LocalSyncAdapter 同接口，业务代码零改动。
// ============================================================

import type { ISyncAdapter, SyncPayload, SyncResult } from './adapter'

/** 默认 Worker 地址（部署的 pos-sync-api）。可用 settings 覆盖 */
export const DEFAULT_CLOUDFLARE_WORKER_URL = 'https://pos-sync-api.hill-helan.workers.dev'

let workerUrl = DEFAULT_CLOUDFLARE_WORKER_URL

/** 设置 Worker 后端地址（商家后台可配置） */
export function setCloudflareWorkerUrl(url: string) {
  if (url && url.trim()) workerUrl = url.trim().replace(/\/+$/, '')
}

/** 当前 Worker 地址 */
export function getCloudflareWorkerUrl(): string {
  return workerUrl
}

export class CloudflareSyncAdapter implements ISyncAdapter {
  /** 初始化：确保 D1 表已建（幂等，失败不阻塞同步） */
  async init(): Promise<void> {
    try {
      await fetch(`${workerUrl}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    } catch (e) {
      console.warn('[sync] Cloudflare init failed (will retry on sync):', e)
    }
  }

  async sync(payload: SyncPayload): Promise<SyncResult> {
    try {
      const res = await fetch(`${workerUrl}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        return { success: false, pulled: {}, server_time: Date.now(), error: `http_${res.status}` }
      }
      const data = (await res.json()) as SyncResult
      return data
    } catch (e) {
      return {
        success: false,
        pulled: {},
        server_time: Date.now(),
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${workerUrl}/`, { signal: AbortSignal.timeout(5000) })
      return res.ok
    } catch {
      return false
    }
  }
}