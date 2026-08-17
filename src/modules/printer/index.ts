// ============================================================
// 打印机抽象层 (Printer Adapter) —— 局域网网络打印机 / 纯中继方案
// 业务端只调统一接口（printReceipt / printKitchenTicket / printOrder），
// 底层通过"本地打印网关"（Node.js，ESC/POS，IP:9100）把指令发给打印机。
// 跨平台通用（走 HTTP 中继，浏览器无 TCP 权限问题），断网走局域网照打。
//
// 纯中继方案（用户已确认）：
//   任意设备(Vue/PWA) --HTTP--> 本地打印网关(收银主设备) --ESC/POS--> 打印机
// 所有端统一走网关，无 Tauri，一条打印线路。
// 本文件为"前端调用网关"的 HTTP 客户端 + 失败降级。
// ============================================================

import type { Order, PrinterConfig, PrinterTaskTag } from '../../models/types'

/** 打印任务类型：对接"任务标签"（全能/堂食/外卖/后厨/小票） */
export interface PrintJob {
  printer_id: string
  tag: PrinterTaskTag
  orderId: string
  seq: number
  payload: string // 打印内容（如 ESC/POS 指令或渲染后的小票文本/JSON）
}

export interface PrintResult {
  success: boolean
  error?: string
  latency?: number
}

/** 本地打印网关配置（收银主设备上的 Node 服务地址） */
export interface GatewayConfig {
  /** 默认 http://127.0.0.1:9200 （收银台本机） */
  baseUrl: string
}

const DEFAULT_GATEWAY: GatewayConfig = { baseUrl: 'http://127.0.0.1:9200' }

let gateway: GatewayConfig = DEFAULT_GATEWAY

/** 设置打印网关地址（商家后台配置文件/设置里填） */
export function setGateway(cfg: Partial<GatewayConfig>) {
  gateway = { ...gateway, ...cfg }
}

/** 发送打印任务到本地网关（HTTP POST） */
export async function sendPrintJob(
  job: PrintJob,
  cfg: GatewayConfig = gateway,
  timeoutMs = 5000,
): Promise<PrintResult> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const t0 = performance.now()
  try {
    const res = await fetch(`${cfg.baseUrl}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return { success: false, error: `gateway_http_${res.status}`, latency: performance.now() - t0 }
    const data = (await res.json()) as PrintResult
    return { ...data, latency: performance.now() - t0 }
  } catch (e) {
    clearTimeout(timer)
    return { success: false, error: e instanceof Error ? e.message : String(e), latency: performance.now() - t0 }
  }
}

// ---- 便捷业务封装 ----

/** 顾客小票 */
export async function printReceipt(order: Order, printer?: PrinterConfig): Promise<PrintResult> {
  return sendPrintJob({ printer_id: printer?.id || '', tag: 'receipt', orderId: order.id, seq: order.seq, payload: JSON.stringify({ type: 'receipt', order }) })
}

/** 后厨单 */
export async function printKitchenOrder(order: Order, printer?: PrinterConfig): Promise<PrintResult> {
  return sendPrintJob({ printer_id: printer?.id || '', tag: 'kitchen', orderId: order.id, seq: order.seq, payload: JSON.stringify({ type: 'kitchen', order }) })
}

/** 打印失败降级：返回是否应提示用户"重试/导出PDF" */
export function shouldFallback(result: PrintResult): boolean {
  return !result.success
}