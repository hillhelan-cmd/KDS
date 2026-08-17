<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSettingsStore } from './store/settings'
import { t, LANGUAGES, setLang, lang } from './i18n'
import { applyTheme } from './core/theme'

const settings = useSettingsStore()
const online = ref(navigator.onLine)
const route = useRoute()
// 后台管理页/自助机页不显示顶部导航（各自独立头部）
const isAdmin = computed(() => route.path.startsWith('/admin') || route.path.startsWith('/kiosk'))

function updateOnline() { online.value = navigator.onLine }
async function init() {
  // 应用店铺主题（店主在后台锁定，全局生效）
  if (!settings.loaded) await settings.load()
  applyTheme(settings.store?.theme)
}
onMounted(() => {
  window.addEventListener('online', updateOnline)
  window.addEventListener('offline', updateOnline)
  init()
})
onUnmounted(() => {
  window.removeEventListener('online', updateOnline)
  window.removeEventListener('offline', updateOnline)
})
</script>

<template>
  <div class="app">
    <header class="topbar" v-if="!isAdmin">
      <div class="brand">
        <span class="logo">🍽️</span>
        <div class="brand-text">
          <h1>{{ t('appName') }}</h1>
          <span class="sub">{{ t('tagline') }}</span>
        </div>
      </div>
      <div class="top-actions">
        <span class="net-badge" :class="online ? 'on' : 'off'">
          <span class="dot"></span>{{ online ? t('online') : t('offline') }}
        </span>
        <select class="lang-select" :value="lang.value" @change="setLang(($event.target as HTMLSelectElement).value as any)">
          <option v-for="l in LANGUAGES" :key="l.key" :value="l.key">{{ l.flag }} {{ l.native }}</option>
        </select>
        <router-link to="/admin" class="admin-entry" :title="t('admin')">⚙️</router-link>
      </div>
    </header>

    <main class="main">
      <router-view />
    </main>
  </div>
</template>