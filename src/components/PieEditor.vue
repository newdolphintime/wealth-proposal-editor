<script setup>
// 可编辑饼图：分类名称、占比、颜色均可修改，可增删分类。
// 合计不等于 100% 时给出提示，并提供“按比例调整为 100%”。
import { computed } from 'vue'

const props = defineProps({
  block: { type: Object, required: true },
  editable: { type: Boolean, default: true }
})
const emit = defineEmits(['edited', 'changed'])

const PALETTE = ['2457C5', 'E08A2E', '0E8A7E', '7A5BB5', '8FA3C0', 'C8322B', '3A9BD9', 'B58A1F']

const total = computed(() => Math.round(props.block.items.reduce((s, i) => s + (Number(i.value) || 0), 0) * 100) / 100)
const balanced = computed(() => Math.abs(total.value - 100) < 0.01)

const pieBg = computed(() => {
  const items = props.block.items.filter(i => Number(i.value) > 0)
  const sum = items.reduce((s, i) => s + Number(i.value), 0)
  if (!sum) return '#EEF1F5'
  let acc = 0
  return `conic-gradient(${items.map(i => {
    const from = acc / sum * 100
    acc += Number(i.value)
    return `#${i.color} ${from}% ${acc / sum * 100}%`
  }).join(', ')})`
})
const ariaLabel = computed(() => props.block.title + '：' + props.block.items.map(i => `${i.label}${i.value}%`).join('，'))

function changed () {
  emit('edited')
  emit('changed')
}
function setValue (item, e) {
  const v = parseFloat(e.target.value)
  item.value = isNaN(v) ? 0 : Math.max(0, Math.min(100, Math.round(v * 10) / 10))
  changed()
}
function setColor (item, e) {
  item.color = e.target.value.replace('#', '').toUpperCase()
  changed()
}
function setLabel (item, e) {
  item.label = e.target.value
  changed()
}
function addItem () {
  const used = new Set(props.block.items.map(i => i.color))
  const color = PALETTE.find(c => !used.has(c)) || PALETTE[props.block.items.length % PALETTE.length]
  props.block.items.push({ label: '新分类', value: 0, color })
  changed()
}
function removeItem (idx) {
  if (props.block.items.length <= 1) return
  props.block.items.splice(idx, 1)
  changed()
}
// 按比例缩放到合计 100%，用最大余数法保证一位小数下合计恰好为 100
function normalize () {
  const items = props.block.items
  const sum = items.reduce((s, i) => s + (Number(i.value) || 0), 0)
  if (!sum) return
  const raw = items.map(i => (Number(i.value) || 0) / sum * 1000)
  const floored = raw.map(Math.floor)
  let rest = 1000 - floored.reduce((s, v) => s + v, 0)
  raw.map((v, i) => [v - floored[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { floored[i]++; rest-- } })
  items.forEach((it, i) => { it.value = floored[i] / 10 })
  changed()
}
</script>

<template>
  <figure class="b-pie">
    <div class="pie" role="img" :aria-label="ariaLabel" :style="{ background: pieBg }"></div>

    <figcaption v-if="!editable">
      <strong>{{ block.title }}</strong>
      <ul>
        <li v-for="(it, i) in block.items" :key="i">
          <span class="swatch" :style="{ background: '#' + it.color }" aria-hidden="true"></span>{{ it.label }}<span class="pie-v">{{ it.value }}%</span>
        </li>
      </ul>
    </figcaption>

    <figcaption v-else class="pie-edit">
      <label class="pie-title">
        <span class="sr-only">图表标题</span>
        <input type="text" :value="block.title" @input="block.title = $event.target.value; changed()">
      </label>
      <div class="pie-rows">
        <div v-for="(it, i) in block.items" :key="i" class="pie-row">
          <label class="color-pick" :style="{ background: '#' + it.color }">
            <span class="sr-only">{{ it.label }} 颜色</span>
            <input type="color" :value="'#' + it.color" @input="setColor(it, $event)">
          </label>
          <label class="pie-label">
            <span class="sr-only">分类名称</span>
            <input type="text" :value="it.label" @input="setLabel(it, $event)">
          </label>
          <label class="pie-num">
            <span class="sr-only">{{ it.label }} 占比</span>
            <input type="number" min="0" max="100" step="0.5" :value="it.value" @change="setValue(it, $event)">
            <span aria-hidden="true">%</span>
          </label>
          <button type="button" class="ibtn" :disabled="block.items.length <= 1" :aria-label="'删除分类 ' + it.label" @click="removeItem(i)">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>
        </div>
      </div>
      <div class="pie-foot">
        <span :class="balanced ? 'ok-text' : 'warn-text'">合计 {{ total }}%{{ balanced ? '' : '（应为 100%）' }}</span>
        <span class="pie-actions">
          <button v-if="!balanced" type="button" class="btn sm" @click="normalize">按比例调整为 100%</button>
          <button type="button" class="btn sm" @click="addItem">+ 添加分类</button>
        </span>
      </div>
    </figcaption>
  </figure>
</template>
