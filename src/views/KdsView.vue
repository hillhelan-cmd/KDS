<script setup lang="ts">
// 后厨屏 KDS (M3)：新订单滚动展示、状态流转、叫号
// 显示所有"进行中"订单（new → preparing → ready），完成的自动归档到完成区
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useOrdersStore } from '../store/orders'
import { useSettingsStore } from '../store/settings'
import { tl, lang } from '../i18n'
import { sourceName, isExternalPlatform } from '../data/sources'
import type { Order, SourceKey } from '../models/types'

const orders = useOrdersStore()
const settings = useSettingsStore()

const loaded = ref(false)
// 播放提示音
let beep: HTMLAudioElement | null = null
// 已读过的订单 id（用于新单提示）
const seenIds = ref<Set<string>>(new Set())
const flashNew = ref(false)

// 状态分组
// 三态流转：等待制作(new) → 制作中(preparing) → 已完成(ready+completed 归入完成区)
const pending = computed(() => orders.orders
  .filter((o) => o.status === 'new')
  .sort((a, b) => (a.created_at || 0) - (b.created_at || 0)))
const cooking = computed(() => orders.orders
  .filter((o) => o.status === 'preparing')
  .sort((a, b) => (a.created_at || 0) - (b.created_at || 0)))
// 已完成区 = ready + completed
const done = computed(() => orders.orders
  .filter((o) => o.status === 'ready' || o.status === 'completed')
  .sort((a, b) => (a.created_at || 0) - (b.created_at || 0)))
// KDS 只看今天 + 进行中/待取
const active = computed(() => orders.orders.filter((o) => {
  const isToday = new Date(o.created_at).toDateString() === new Date().toDateString()
  return isToday && ['new', 'preparing', 'ready', 'completed'].includes(o.status)
}))

// "显示已完成"开关（存 settings，本地记忆，默认显示）
const showDone = ref(true)
async function loadShowDone() {
  try { showDone.value = settings.store?.kds_show_done !== false } catch { showDone.value = true }
}
async function toggleShowDone() {
  showDone.value = !showDone.value
  try { await settings.save({ kds_show_done: showDone.value }) } catch (e) { console.error(e) }
}

onMounted(async () => {
  if (!orders.loaded) await orders.load()
  if (!settings.loaded) await settings.load()
  await loadShowDone()
  loaded.value = true
  updateClock()
  setInterval(updateClock, 1000)
  function updateClock() {
    const el = document.getElementById('clock')
    if (el) el.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  // 建立音频提示
  try {
    beep = new Audio('data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVoAAACAgICAf39/f39/f4CAgIB/f39/f39/gICAgH9/f39/f4CAgIB/f39/f4CAgH9/f39/gICAf39/f39/f4CAgIB/f39/f4CAgIB/f39/f4CAgIB/f39/f4CAgIB/f39/f4CAgIB/f39/f4CAgIB/f39/fw==')
  } catch { /* 忽略 */ }

  // 定时刷新 + 新单检测（本地库没有推送，轮询兜底）
  const timer = setInterval(async () => {
    await orders.load()
    checkNew()
  }, 3000)
  checkNew()

  function checkNew() {
    const newIds = orders.orders.map((o) => o.id)
    const hasNew = newIds.some((id) => !seenIds.value.has(id) && orders.orders.find((o) => o.id === id)?.status === 'new')
    if (hasNew && seenIds.value.size > 0) {
      flashNew.value = true
      beep?.play().catch(() => {})
      setTimeout(() => (flashNew.value = false), 4000)
    }
    newIds.forEach((id) => seenIds.value.add(id))
  }

  onUnmounted(() => clearInterval(timer))
})

async function setStatus(o: Order, status: Order['status']) {
  await orders.updateStatus(o.id, status)
}

function sourceIcon(o: Order): string {
  const map: Record<string, string> = { dinein: '🏠', takeaway: '🥡', web: '🌐' }
  return map[o.source] || '🛍️'
}
const sourceLabel = (k: SourceKey) => sourceName(k, lang.value)
const isDelivery = (o: Order) => o.dine_type === 'delivery' || isExternalPlatform(o.source)
</script>

<template>
  <div class="kds">
    <header class="kds-top">
      <div class="kds-brand">
        <span class="kds-logo">🍽️</span>
        <div>
          <h2>后厨屏 KDS</h2>
          <span class="kds-meta">{{ settings.store?.name || '达三江' }} · {{ tl({ zh: '今日订单', en: 'Today', nl: 'Vandaag' }) }} {{ orders.todayOrders.length }}</span>
        </div>
      </div>
      <div class="kds-right">
        <button class="done-toggle" :class="{ on: showDone }" @click="toggleShowDone">
          {{ showDone ? '🙈 隐藏已完成' : '👁 显示已完成' }}
        </button>
        <div class="kds-clock" id="clock"></div>
      </div>
    </header>

    <div class="kds-flash" v-if="flashNew">🔔 {{ tl({ zh: '新订单！', en: 'New order!', nl: 'Nieuwe bestelling!' }) }}</div>

    <div v-if="!loaded" class="kds-empty muted">加载中…</div>
    <div v-else-if="active.length === 0" class="kds-empty">
      <div class="kds-empty-icon">🌤️</div>
      <p>{{ tl({ zh: '暂无进行中的订单', en: 'No active orders', nl: 'Geen actieve bestellingen' }) }}</p>
    </div>

    <div v-else class="kds-board">
      <!-- 等待制作栏 -->
      <section class="kds-col" :class="{ hot: pending.length }">
        <h3 class="col-title new">🔴 {{ tl({ zh: '等待制作', en: 'New', nl: 'Nieuw' }) }} <b>{{ pending.length }}</b></h3>
        <div class="col-cards">
          <article v-for="o in pending" :key="o.id" class="kds-card new">
            <div class="card-head">
              <span class="ord-no">#{{ o.seq }}</span>
              <span class="src-badge">{{ sourceIcon(o) }} {{ sourceLabel(o.source) }}</span>
              <span class="time">{{ new Date(o.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span>
            </div>
            <div class="card-table" v-if="o.table_no">🪑 {{ o.table_no }}</div>
            <div class="card-delivery" v-if="isDelivery(o)">
              <div v-if="o.address">📍 {{ o.address }}</div>
              <div v-if="o.phone" class="tel">📞 {{ o.phone }}</div>
              <div v-if="o.remark" class="muted">💬 {{ o.remark }}</div>
            </div>
            <ul class="items">
              <li v-for="(it, i) in o.items" :key="i">
                <b>{{ it.qty }}×</b> {{ it.name }}
                <span v-if="it.opts?.length" class="opts">{{ it.opts.map(x => '+' + x.name).join(', ') }}</span>
              </li>
            </ul>
            <button class="act-btn start" @click="setStatus(o, 'preparing')">▶ {{ tl({ zh: '开始制作', en: 'Start', nl: 'Start' }) }}</button>
          </article>
        </div>
      </section>

      <!-- 制作中栏 -->
      <section class="kds-col">
        <h3 class="col-title prep">🟡 {{ tl({ zh: '制作中', en: 'Preparing', nl: 'Bezig' }) }} <b>{{ cooking.length }}</b></h3>
        <div class="col-cards">
          <article v-for="o in cooking" :key="o.id" class="kds-card prep">
            <div class="card-head">
              <span class="ord-no">#{{ o.seq }}</span>
              <span class="src-badge">{{ sourceIcon(o) }} {{ sourceLabel(o.source) }}</span>
              <span class="time">{{ new Date(o.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span>
            </div>
            <div class="card-table" v-if="o.table_no">🪑 {{ o.table_no }}</div>
            <div class="card-delivery" v-if="isDelivery(o)">
              <div v-if="o.address">📍 {{ o.address }}</div>
              <div v-if="o.phone" class="tel">📞 {{ o.phone }}</div>
            </div>
            <ul class="items">
              <li v-for="(it, i) in o.items" :key="i"><b>{{ it.qty }}×</b> {{ it.name }}</li>
            </ul>
            <button class="act-btn done" @click="setStatus(o, 'completed')">✔ {{ tl({ zh: '完成制作', en: 'Finish', nl: 'Klaar' }) }}</button>
          </article>
        </div>
      </section>

      <!-- 已完成栏（由开关控制显示） -->
      <section class="kds-col" v-if="showDone">
        <h3 class="col-title done">🟢 {{ tl({ zh: '已完成', en: 'Done', nl: 'Klaar' }) }} <b>{{ done.length }}</b></h3>
        <div class="col-cards">
          <article v-for="o in done" :key="o.id" class="kds-card done">
            <div class="card-head">
              <span class="ord-no">#{{ o.seq }}</span>
              <span class="src-badge">{{ sourceIcon(o) }} {{ sourceLabel(o.source) }}</span>
              <span class="time">{{ new Date(o.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span>
            </div>
            <div class="card-table" v-if="o.table_no">🪑 {{ o.table_no }}</div>
            <div class="card-delivery" v-if="isDelivery(o)">
              <div v-if="o.address">📍 {{ o.address }}</div>
              <div v-if="o.phone" class="tel">📞 {{ o.phone }}</div>
            </div>
            <ul class="items">
              <li v-for="(it, i) in o.items" :key="i"><b>{{ it.qty }}×</b> {{ it.name }}</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.kds { height: 100vh; display: flex; flex-direction: column; background: #f4f5f7; }
.kds-top { background: #1f2937; color: #fff; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; }
.kds-brand { display: flex; align-items: center; gap: 12px; }
.kds-logo { font-size: 28px; }
.kds-brand h2 { font-size: 20px; }
.kds-meta { font-size: 12px; opacity: .7; }
.kds-right { display: flex; align-items: center; gap: 12px; }
.kds-clock { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
.done-toggle {
  border: none; border-radius: 20px; padding: 7px 14px; font-size: 13px; font-weight: 700;
  background: #e5e7eb; color: #4b5563; cursor: pointer; transition: all .2s;
}
.done-toggle.on { background: #dcfce7; color: #166534; }
.kds-flash { background: #f59e0b; color: #1f2937; text-align: center; padding: 10px; font-weight: 700; animation: pulse 1s infinite; }
@keyframes pulse { 0%,100% {opacity:1} 50% {opacity:.6} }
.kds-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #9ca3af; gap: 10px; }
.kds-empty-icon { font-size: 56px; }
.kds-board { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 14px; overflow: hidden; width: 100%; }
.kds-col { background: #eef0f2; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; min-height: 0; }
.col-title { font-size: 16px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
.col-title b { background: #fff; border-radius: 12px; padding: 1px 9px; font-size: 15px; }
.col-title.new { color: #dc2626; }
.col-title.prep { color: #d97706; }
.col-title.ready { color: #16a34a; }
.col-title.done { color: #147a3c; }
.col-cards { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.kds-card { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08); border-left: 5px solid #d1d5db; }
.kds-card.new { border-left-color: #ef4444; }
.kds-card.prep { border-left-color: #f59e0b; }
.kds-card.ready { border-left-color: #22c55e; }
.kds-card.done { border-left-color: #16a34a; opacity: .85; }
.card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.ord-no { font-size: 22px; font-weight: 800; }
.src-badge { background: #f3f4f6; border-radius: 12px; padding: 2px 8px; font-size: 12px; }
.time { margin-left: auto; color: #9ca3af; font-size: 13px; }
.card-table { font-weight: 700; color: #374151; margin-bottom: 6px; }
.card-delivery { background: #eff6ff; border-radius: 8px; padding: 6px 8px; font-size: 13px; margin-bottom: 8px; }
.card-delivery .tel { color: #2563eb; }
.items { list-style: none; }
.items li { padding: 3px 0; font-size: 15px; border-bottom: 1px dashed #f3f4f6; }
.items li:last-child { border-bottom: none; }
.items .opts { color: #6b7280; font-size: 12px; }
.act-btn { margin-top: 10px; width: 100%; border: none; border-radius: 9px; padding: 11px; font-size: 15px; font-weight: 700; }
.act-btn.start { background: #ef4444; color: #fff; }
.act-btn.done { background: #16a34a; color: #fff; }
@media (max-width: 800px) { .kds-board { grid-template-columns: 1fr; overflow: auto; } }
</style>