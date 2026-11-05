<script setup>
// 可编辑文本：用 contenteditable 承载纯文本。
// 文本只在“非输入状态”时由数据写入 DOM，避免输入过程中光标被重置；
// 粘贴时只保留纯文本，杜绝网页样式混入导致 Word 导出格式不受控。
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  tag: { type: String, default: 'p' },
  editable: { type: Boolean, default: true }
})
const emit = defineEmits(['update:modelValue', 'edited'])
const el = ref(null)
let focused = false

function sync () {
  if (el.value && !focused && el.value.innerText !== props.modelValue) el.value.innerText = props.modelValue
}
onMounted(sync)
watch(() => props.modelValue, sync)

function onInput () {
  emit('update:modelValue', el.value.innerText.replace(/\n{3,}/g, '\n\n'))
  emit('edited')
}
function onPaste (e) {
  e.preventDefault()
  const text = (e.clipboardData || window.clipboardData).getData('text/plain')
  document.execCommand('insertText', false, text)
}
function onKeydown (e) {
  // 标题、表格单元格等单行字段禁止回车换行
  if (e.key === 'Enter' && ['h1', 'h2', 'td', 'th', 'span'].includes(props.tag)) e.preventDefault()
}
</script>

<template>
  <component
    :is="tag"
    ref="el"
    class="editable"
    :contenteditable="editable ? 'plaintext-only' : 'false'"
    spellcheck="false"
    @input="onInput"
    @paste="onPaste"
    @keydown="onKeydown"
    @focus="focused = true"
    @blur="focused = false; sync()"
  ></component>
</template>
