// ============================================================
// 支付抽象层 (Payment Adapter) —— 接口先行，实现可后补
// 现在（M1）只做"手动/现金/模拟"支付；预留雅本(Yabie)/刷卡机/IDEAL 适配。
// 核心：payment_status 状态机（pending/paid/failed/canceled）由订单承载，
// 支付适配器只负责"发起支付 + 接收结果"，业务层不感知具体通道。
// ============================================================

import type { Order, PaymentStatus } from '../../models/types'

export type PaymentMethod = 'cash' | 'card' | 'ideal' | 'qr' | 'manual'

export interface PaymentRequest {
  order: Order
  method: PaymentMethod
  amount: number
}

export interface PaymentResult {
  success: boolean
  status: PaymentStatus
  reference?: string // 支付参考号/流水号
  error?: string
}

/** 支付适配器接口 */
export interface IPaymentAdapter {
  /** 发起支付（同步完成或异步等待回调） */
  charge(req: PaymentRequest): Promise<PaymentResult>
  /** 查询某订单支付状态（防死锁：支付挂起时可手动查询） */
  queryStatus(order: Order): Promise<PaymentResult>
}

/** M1 默认：手动/现金/模拟支付 —— 立即标记为已支付 */
export class ManualPaymentAdapter implements IPaymentAdapter {
  async charge(_req: PaymentRequest): Promise<PaymentResult> {
    // 模拟：立即成功。真实刷卡集成时由对应 Adapter 替换。
    return { success: true, status: 'paid', reference: `manual_${Date.now()}` }
  }
  async queryStatus(_order: Order): Promise<PaymentResult> {
    return { success: true, status: 'paid' }
  }
}

let paymentAdapter: IPaymentAdapter | null = null

export function setPaymentAdapter(a: IPaymentAdapter) {
  paymentAdapter = a
}

export function getPaymentAdapter(): IPaymentAdapter {
  if (!paymentAdapter) paymentAdapter = new ManualPaymentAdapter()
  return paymentAdapter
}

/** 业务层统一入口：给订单收银 */
export async function payOrder(order: Order, method: PaymentMethod): Promise<PaymentResult> {
  const a = getPaymentAdapter()
  const res = await a.charge({ order, method, amount: order.grand_total })
  return res
}

/** 离线支付降级（断网时）：生成"待结账凭证"，柜台扫码结算 —— M4 实现 */
export interface OfflineCheckoutVoucher {
  orderId: string
  seq: number
  amount: number
  timestamp: number
  code: string // 离线校验码
}