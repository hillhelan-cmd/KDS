<script setup lang="ts">
// 过敏源过滤面板 —— 顾客勾选过敏标签，菜品即时禁用
import { ALLERGEN_TAGS } from '../modules/allergen'
import { tl } from '../i18n'

const props = defineProps<{
  selected: Set<string>
  active: boolean
}>()
const emit = defineEmits<{
  (e: 'toggle', key: string): void
  (e: 'clear'): void
}>()
</script>

<template>
  <div class="allergen-panel">
    <div class="panel-head">
      <span class="panel-title">🧊 {{ tl({ zh: '过敏源过滤', en: 'Allergen filter', nl: 'Allergeenfilter' }) }}</span>
      <button v-if="active" class="clear-btn" @click="emit('clear')">{{ tl({ zh: '清除', en: 'Clear', nl: 'Wissen' }) }}</button>
    </div>
    <div class="chips">
      <button
        v-for="a in ALLERGEN_TAGS"
        :key="a.key"
        class="chip"
        :class="{ sel: selected.has(a.key) }"
        @click="emit('toggle', a.key)"
      >{{ a.icon }} {{ tl(a.label) }}</button>
    </div>
  </div>
</template>

<style scoped>
.allergen-panel {
  background: var(--card); border-radius: var(--radius);
  box-shadow: var(--shadow); padding: 12px 14px; margin-bottom: 12px;
}
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.panel-title { font-weight: 700; font-size: 14px; }
.clear-btn {
  font-size: 12px; color: var(--primary);
  background: none; border: 1px solid var(--primary);
  padding: 3px 10px; border-radius: 14px;
}
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  border: 1.5px solid var(--border); background: var(--card);
  padding: 6px 12px; border-radius: 20px; font-size: 13px;
  transition: all 0.2s;
}
.chip.sel { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); font-weight: 600; }
</style>