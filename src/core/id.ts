// ============================================================
// 全局唯一 ID 生成机制 (UUID + 时间戳)
// 本地优先架构：所有实体用 UUID 作主键，保证多设备离线各自生成
// 不冲突；时间戳用于同步时的增量比对和冲突解决。
// ============================================================

import { v4 as uuidv4 } from 'uuid'

export type ID = string

/** 生成全局唯一 ID（UUID v4） */
export function newId(): ID {
  return uuidv4()
}

/**
 * 生成"排序友好"的唯一标识：
 * 前缀 2 位 + 时间戳（13位，可排序）+ UUID 短后缀。
 * 用于订单流水等需要"接近创建顺序"的主键场景。
 */
export function orderedId(prefix = 'id'): ID {
  return `${prefix}_${Date.now()}_${uuidv4().slice(0, 8)}`
}

/** 当前毫秒时间戳 */
export function now(): number {
  return Date.now()
}

/** 本地设备指纹（用于同步标识设备身份；真实硬件指纹留授权模块，这里先用随机+存储） */
export function deviceId(): string {
  try {
    let d = localStorage.getItem('pos_device_id')
    if (!d) {
      d = uuidv4()
      localStorage.setItem('pos_device_id', d)
    }
    return d
  } catch {
    return uuidv4()
  }
}

/**
 * 时间戳工具
 */
export function fmtTs(ts: number, withSeconds = false): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  const base = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  return withSeconds ? `${base}:${p(d.getSeconds())}` : base
}