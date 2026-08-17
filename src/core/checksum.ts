// ============================================================
// 校验和 (Checksum) 基础层
// 用途：
//   1. 防篡改：订单/价格等敏感数据带 checksum，读取时校验，被改即报警拒处理
//   2. 同步完整性：判断记录在传输中是否损坏
// 采用轻量可复现的字符串哈希（不依赖 Node/Buffer，纯 JS 跨端一致）。
// 真实商用可选更强的算法（如 SHA-256 via Web Crypto），此处接口已抽象。
// ============================================================

/** FNV-1a 32位哈希，纯 JS，跨端结果一致，转 16 进制字符串 */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * 生成记录校验和：把记录的"关键字段"拍平序列化后计算。
 * @param obj    要保护的记录（可含业务字段）
 * @param fields 参与校验的字段名；不传则用整个对象
 */
export function makeChecksum(obj: Record<string, unknown>, fields?: string[]): string {
  const pick: Record<string, unknown> = {}
  if (fields && fields.length) {
    for (const f of fields) {
      if (obj[f] !== undefined) pick[f] = obj[f]
    }
  } else {
    Object.assign(pick, obj)
  }
  // 剔除自带的 checksum / 时间戳等易变字段，避免自指
  delete pick.checksum
  delete pick.updated_at
  delete pick.created_at
  const json = stableStringify(pick)
  return fnv1a(json)
}

/** 给记录附加 checksum 字段 */
export function withChecksum<T extends Record<string, unknown>>(obj: T, fields?: string[]): T & { checksum: string } {
  return { ...obj, checksum: makeChecksum(obj, fields) }
}

/** 校验记录 checksum 是否一致；不一致返回 false */
export function verifyChecksum(obj: Record<string, unknown>, fields?: string[]): boolean {
  if (!obj || obj.checksum === undefined) return false
  const expected = obj.checksum as string
  const recompute = makeChecksum(obj, fields)
  return expected === recompute
}

/** 稳定序列化：key 排序，保证跨端结果一致 */
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((v) => stableStringify(v)).join(',') + ']'
  }
  const keys = Object.keys(obj as object).sort()
  let out = '{'
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    out += JSON.stringify(k) + ':' + stableStringify((obj as Record<string, unknown>)[k])
    if (i < keys.length - 1) out += ','
  }
  return out + '}'
}