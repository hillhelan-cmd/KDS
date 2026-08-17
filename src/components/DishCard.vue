<script setup lang="ts">
// 菜品卡片组件 —— 支持过敏源禁用态 / 售罄 / 加购
import { computed } from 'vue'
import { tl } from '../i18n'
import type { Product } from '../models/types'

const props = defineProps<{
  product: Product
  qty: number
  disabled: boolean          // 过敏源命中 → 禁用
  matchedAllergens: string[] // 命中的过敏原
}>()

const emit = defineEmits<{
  (e: 'add', product: Product): void        // 加入购物车（或打开选项弹窗）
  (e: 'change', delta: number, product: Product): void
  (e: 'info', product: Product): void       // 点击过敏源提示
}>()

const isEmoji = computed(() => props.product.img != null && props.product.img.length <= 4)
const hasOpts = computed(() => props.product.opts && props.product.opts.length > 0)
</script>

<template>
  <div class="dish-card" :class="{ 'is-disabled': disabled }">
    <div class="thumb" v-if="product.img">
      <span v-if="isEmoji">{{ product.img }}</span>
      <img v-else :src="product.img" :alt="product.name.zh" loading="lazy" />
      <div class="alrg-badge" v-if="product.alrg" @click="emit('info', product)" title="allergen">⚠️</div>
    </div>

    <div class="body">
      <div class="name">{{ tl(product.name) }}</div>
      <div class="desc muted" v-if="product.desc && !disabled">{{ tl(product.desc) }}</div>

      <!-- 过敏源禁用提示 -->
      <div class="disabled-msg" v-if="disabled" @click="emit('info', product)">
        <span>🔒</span> 含过敏原 ({{ matchedAllergens.length }})
      </div>

      <div class="price-row">
        <span class="price">€{{ product.price.toFixed(2) }}</span>
        <span v-if="hasOpts && !disabled" class="opt-flag">🧂</span>

        <!-- 无选项：数量控制 -->
        <div v-if="!hasOpts && !disabled" class="qty-ctrl">
          <button v-if="qty > 0" class="minus" @click="emit('change', -1, product)">−</button>
          <span v-if="qty > 0" class="qnum">{{ qty }}</span>
          <button class="plus" @click="emit('change', 1, product)">＋</button>
        </div>
        <!-- 有选项：打开弹窗 -->
        <button v-else-if="!disabled" class="add-btn" @click="emit('add', product)">＋</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dish-card {
  background: var(--card);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: opacity 0.2s;
  position: relative;
}
.dish-card.is-disabled { opacity: 0.5; }

.thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 0.8;
  background: #f5f5f5;
  display: flex; align-items: center; justify-content: center;
  font-size: 40px;
  overflow: hidden;
}
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.alrg-badge {
  position: absolute; top: 6px; right: 6px;
  background: rgba(233,98,20,0.9); color: #fff;
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; cursor: pointer;
}

.body { padding: 10px; flex: 1; display: flex; flex-direction: column; }
.name { font-weight: 700; font-size: 14px; line-height: 1.3; }
.desc { font-size: 12px; margin-top: 2px; }
.disabled-msg {
  margin-top: 4px; font-size: 11px; color: var(--danger); font-weight: 600;
  display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
}

.price-row {
  margin-top: auto; padding-top: 8px;
  display: flex; align-items: center; gap: 6px;
}
.price { color: var(--primary); font-weight: 800; font-size: 17px; }
.opt-flag { font-size: 12px; }
.qty-ctrl { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.qty-ctrl button {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid var(--primary); background: #fff; color: var(--primary);
  font-size: 16px; cursor: pointer; line-height: 1;
}
.qty-ctrl button.plus { background: var(--primary); color: #fff; font-weight: 700; }
.qty-ctrl .qnum { min-width: 20px; text-align: center; font-weight: 700; }
.add-btn {
  margin-left: auto; width: 34px; height: 34px; border-radius: 50%;
  background: var(--primary); color: #fff; border: none;
  font-size: 20px; font-weight: 700; line-height: 1;
}
</style>