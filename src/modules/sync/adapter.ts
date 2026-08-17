// ============================================================
// 同步引擎抽象 (Sync Adapter) —— 接口先行，实现可后补
// 本地优先的核心接口。上层业务只依赖此接口，不感知具体后端。
// 现在（M1，无后端）用 LocalAdapter（占位，只记录状态，不真传云端）。
// 以后接 Supabase / 自建 Postgres，写一个对应 Adapter 即可，
// 业务代码零改动 —— 满足"升级空间"与"后端可替换"。
// ============================================================

import { deviceId } from '../../core/id'
import type { DbRecord } from '../../core/db'

export type SyncAction = 'push' | 'pull'

export interface SyncPayload {
  device_id: string
  last_sync_at: number
  // 增量数据，按表名分组
  pushed: Record<string, DbRecord[]>
}

export interface SyncResult {
  success: boolean
  pulled: Record<string, DbRecord[]>
  server_time: number
  error?: string
}

/** 同步适配器接口：本地库无论用什么后端，都走这个形状 */
export interface ISyncAdapter {
  /** 推送本地增量到云端，并拉回云端增量 */
  sync(payload: SyncPayload): Promise<SyncResult>
  /** 检查网络/连接状态 */
  ping(): Promise<boolean>
}

/**
 * 本地占位适配器（M1，单机无后端）。
 * 不做真实传输，仅记录同步意图并返回空拉取。
 * 用于前端开发/单机跑通；接后端时替换为 SupabaseAdapter。
 */
export class LocalSyncAdapter implements ISyncAdapter {
  async sync(payload: SyncPayload): Promise<SyncResult> {
    // TODO(M2): 在此实现本地增量 push/pull 或接入真实后端
    console.warn('[sync] LocalSyncAdapter: 无后端，跳过真实同步', payload)
    return { success: true, pulled: {}, server_time: Date.now() }
  }
  async ping(): Promise<boolean> {
    // 本地模式视为"在线"（单机自身）
    return navigator?.onLine ?? true
  }
}

let adapter: ISyncAdapter | null = null

/** 设置同步适配器（启动时注入；当前默认 Local） */
export function setSyncAdapter(a: ISyncAdapter) {
  adapter = a
}

/** 获取当前同步适配器（默认 Local） */
export function getSyncAdapter(): ISyncAdapter {
  if (!adapter) adapter = new LocalSyncAdapter()
  return adapter
}

/** 执行一次同步（封装：设备ID + 断点续传 + 网络监听由 M2 引擎负责） */
export async function runSync(tables: Record<string, DbRecord[]>, lastSyncAt: number): Promise<SyncResult> {
  const a = getSyncAdapter()
  return a.sync({
    device_id: deviceId(),
    last_sync_at: lastSyncAt,
    pushed: tables,
  })
}

/** 网络状态监听：供 UI 显示在线/离线，并触发自动同步 */
export function watchNetwork(onChange: (online: boolean) => void): () => void {
  const handler = () => onChange(navigator.onLine)
  window.addEventListener('online', handler)
  window.addEventListener('offline', handler)
  return () => {
    window.removeEventListener('online', handler)
    window.removeEventListener('offline', handler)
  }
}