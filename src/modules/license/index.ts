// ============================================================
// 授权抽象层 (License) —— 接口先行，实现可后补
// 预留：基于硬件的 License 校验、心跳、受限模式。
// M1 单机免授权运行（licensed=true），但接口和字段已立好，
// 以后做防盗版/商用授权时填实现，不重打地基。
// ============================================================

import { deviceId } from '../../core/id'

export type LicenseMode = 'full' | 'restricted'

export interface LicenseInfo {
  licensed: boolean
  mode: LicenseMode
  hardware_id: string
  license_key?: string
  /** 授权到期（心跳：30 天需联网校验一次） */
  expires_at?: number
}

/** 硬件指纹（预留）：M4 基于设备主板/网卡生成真实指纹；现在用持久化随机 ID */
export function hardwareId(): string {
  // TODO(M4): 基于浏览器/系统指纹生成更稳定的硬件 ID
  return `hw_${deviceId()}`
}

const _default: LicenseInfo = {
  licensed: true, // M1 单机默认全功能授权，不做校验
  mode: 'full',
  hardware_id: hardwareId(),
}

/** 获取当前授权状态（M1：始终 full） */
export function getLicense(): LicenseInfo {
  // TODO(M4): 读取本地加密区授权；30 天心跳；到期切 restricted（可查不可新增订单）
  return _default
}

/** 校验一个 License Key 是否有效（M4 实现签名验证） */
export async function verifyLicense(_key: string): Promise<boolean> {
  // TODO(M4): 服务端签发/验签
  return true
}