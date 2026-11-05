<script setup>
import { computed } from 'vue'
import EditableText from './EditableText.vue'

const props = defineProps({
  block: { type: Object, required: true },
  editable: { type: Boolean, default: true },
  num: { type: String, default: '' }
})
const emit = defineEmits(['edited'])
const edited = () => emit('edited')

const pieBg = computed(() => {
  if (props.block.type !== 'pie') return ''
  const total = props.block.items.reduce((s, i) => s + i.value, 0)
  let acc = 0
  const stops = props.block.items.map(i => {
    const from = acc / total * 100
    acc += i.value
    return `#${i.color} ${from}% ${acc / total * 100}%`
  })
  return `conic-gradient(${stops.join(', ')})`
})
const pieLabel = computed(() => props.block.type === 'pie'
  ? props.block.title + '：' + props.block.items.map(i => `${i.label}${i.value}%`).join('，')
  : '')
</script>

<template>
  <div v-if="block.type === 'cover'" class="b-cover">
    <EditableText v-model="block.org" tag="span" class="cover-org" :editable="editable" @edited="edited" />
    <EditableText v-model="block.title" tag="h1" :editable="editable" @edited="edited" />
    <EditableText v-model="block.greeting" tag="span" class="cover-greet" :editable="editable" @edited="edited" />
    <EditableText v-model="block.meta" tag="span" class="cover-meta" :editable="editable" @edited="edited" />
  </div>

  <div v-else-if="block.type === 'h'" class="b-h">
    <span v-if="num" class="h-num">{{ num }}</span>
    <EditableText v-model="block.text" tag="h2" :editable="editable" @edited="edited" />
  </div>

  <EditableText v-else-if="block.type === 'p'" v-model="block.text" tag="p" class="b-p" :editable="editable" @edited="edited" />

  <EditableText v-else-if="block.type === 'note'" v-model="block.text" tag="p" class="b-note" :editable="editable" @edited="edited" />

  <div v-else-if="block.type === 'table'" class="b-table-wrap">
    <table class="b-table">
      <thead>
        <tr><th v-for="(h, i) in block.head" :key="i" :class="{ r: block.align[i] === 'r' }">{{ h }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in block.rows" :key="ri">
          <EditableText
            v-for="(cell, ci) in row" :key="ci"
            v-model="row[ci]" tag="td" :class="{ r: block.align[ci] === 'r' }"
            :editable="editable" @edited="edited"
          />
        </tr>
      </tbody>
    </table>
  </div>

  <figure v-else-if="block.type === 'pie'" class="b-pie">
    <div class="pie" role="img" :aria-label="pieLabel" :style="{ background: pieBg }"></div>
    <figcaption>
      <strong>{{ block.title }}</strong>
      <ul>
        <li v-for="it in block.items" :key="it.label">
          <span class="swatch" :style="{ background: '#' + it.color }" aria-hidden="true"></span>{{ it.label }}<span class="pie-v">{{ it.value }}%</span>
        </li>
      </ul>
    </figcaption>
  </figure>

  <ol v-else-if="block.type === 'ol'" class="b-ol">
    <EditableText v-for="(it, i) in block.items" :key="i" v-model="block.items[i]" tag="li" :editable="editable" @edited="edited" />
  </ol>
</template>
