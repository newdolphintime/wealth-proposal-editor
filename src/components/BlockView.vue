<script setup>
import EditableText from './EditableText.vue'
import PieEditor from './PieEditor.vue'

defineProps({
  block: { type: Object, required: true },
  editable: { type: Boolean, default: true },
  num: { type: String, default: '' }
})
const emit = defineEmits(['edited', 'pie-changed'])
const edited = () => emit('edited')
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

  <PieEditor v-else-if="block.type === 'pie'" :block="block" :editable="editable" @edited="edited" @changed="emit('pie-changed')" />

  <ol v-else-if="block.type === 'ol'" class="b-ol">
    <EditableText v-for="(it, i) in block.items" :key="i" v-model="block.items[i]" tag="li" :editable="editable" @edited="edited" />
  </ol>
</template>
