<script setup>
import { reactive, computed, onMounted } from 'vue'
import { saveAs } from 'file-saver'
import BlockView from './components/BlockView.vue'
import { LIBRARY, libraryItem, generateModule } from './modules.js'
import { buildDocx } from './exportDocx.js'
import { client } from './mockData.js'

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五']
let uidSeed = 0
const newMod = type => ({ uid: ++uidSeed, type, status: 'pending', edited: false, blocks: [], opts: { tone: '专业严谨', note: '' } })

const state = reactive({
  mods: ['cover', 'profile', 'assets', 'alloc', 'disclaimer'].map(newMod),
  sel: null,
  confirmUid: null,
  preview: false,
  zoom: 1,
  toast: null,
  exporting: false,
  dropHint: null
})
let drag = { type: null, idx: null }
let toastTimer = null

const STATUS = {
  pending: { text: '待生成', cls: 'st-pending' },
  generating: { text: '生成中', cls: 'st-generating' },
  done: { text: '已生成', cls: 'st-done' },
  edited: { text: '已人工修改', cls: 'st-edited' },
  error: { text: '生成失败', cls: 'st-error' }
}
const statusOf = m => (m.status === 'done' && m.edited) ? STATUS.edited : STATUS[m.status]

// 章节编号：封面和免责声明不编号
const chapterNums = computed(() => {
  let n = 0
  const map = {}
  state.mods.forEach(m => { map[m.uid] = (m.type === 'cover' || m.type === 'disclaimer') ? '' : CN_NUM[n++] + '、' })
  return map
})

const doneCount = computed(() => state.mods.filter(m => m.status === 'done').length)
const notDone = computed(() => state.mods.filter(m => m.status !== 'done'))
const current = computed(() => state.mods.find(m => m.uid === state.sel) || null)

const libItems = computed(() => LIBRARY.map((l, i) => ({
  ...l,
  no: String(i + 1).padStart(2, '0'),
  disabled: !!l.single && state.mods.some(m => m.type === l.type)
})))

function flash (text, kind = 'info') {
  state.toast = { text, kind }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { state.toast = null }, 4500)
}

// ---------- 模块增删排序 ----------
function defaultInsertIndex (type) {
  if (type === 'cover') return 0
  const di = state.mods.findIndex(m => m.type === 'disclaimer')
  return di === -1 ? state.mods.length : di // 新模块默认插在免责声明之前
}
function insertModule (type, index) {
  const l = libraryItem(type)
  if (l.single && state.mods.some(m => m.type === type)) { flash(`「${l.name}」只能添加一次。`, 'warn'); return }
  const m = newMod(type)
  state.mods.splice(index, 0, m)
  state.sel = m.uid
}
function moveModule (from, to) {
  if (from === to || from + 1 === to) return
  const [m] = state.mods.splice(from, 1)
  state.mods.splice(to > from ? to - 1 : to, 0, m)
}
function removeModule (m) {
  if (libraryItem(m.type).required) return
  state.mods.splice(state.mods.indexOf(m), 1)
  if (state.sel === m.uid) state.sel = null
}

// ---------- 拖拽 ----------
function onLibDragStart (e, type) {
  drag = { type, idx: null }
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('text/plain', type)
}
function onModDragStart (e, idx) {
  if (e.target.closest && e.target.closest('[contenteditable="plaintext-only"], input, textarea, select')) { e.preventDefault(); return }
  drag = { type: null, idx }
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', 'module-' + idx)
}
function onDragOverAt (idx) { state.dropHint = idx }
function onDropAt (idx) {
  if (drag.type) insertModule(drag.type, idx)
  else if (drag.idx != null) moveModule(drag.idx, idx)
  drag = { type: null, idx: null }
  state.dropHint = null
}
function onDragEnd () { drag = { type: null, idx: null }; state.dropHint = null }

// ---------- 生成 ----------
async function generate (m) {
  if (m.status === 'done' && m.edited && state.confirmUid !== m.uid) { state.confirmUid = m.uid; return }
  state.confirmUid = null
  m.status = 'generating'
  try {
    m.blocks = await generateModule(m.type, m.opts)
    m.status = 'done'
    m.edited = false
  } catch (err) {
    m.status = 'error'
    flash(`「${libraryItem(m.type).name}」生成失败，请重试。`, 'warn')
  }
}
async function generateAll () {
  const list = state.mods.filter(m => m.status === 'pending' || m.status === 'error')
  if (!list.length) { flash('没有待生成的模块。'); return }
  await Promise.all(list.map((m, i) => new Promise(r => setTimeout(r, i * 300)).then(() => generate(m))))
}

// ---------- 饼图与配置表联动 ----------
// 饼图的分类/占比改动后，同步更新同一模块中 link: 'pie' 的表格：
// 按分类名匹配原有行（保留“当前”列），重算“建议”和“调整（万元）”列；新增分类当前占比记为 0%。
function syncPieTable (m) {
  const pie = m.blocks.find(b => b.type === 'pie')
  const tbl = m.blocks.find(b => b.type === 'table' && b.link === 'pie')
  if (!pie || !tbl) return
  const oldRows = tbl.rows
  const byLabel = new Map(oldRows.map(r => [r[0], r]))
  tbl.rows = pie.items.map((it, i) => {
    // 先按名称匹配；分类改名时按原位置沿用“当前”列
    const sameSlot = oldRows[i] && !pie.items.some(x => x.label === oldRows[i][0]) ? oldRows[i] : null
    const prev = byLabel.get(it.label) || sameSlot
    const current = prev ? parseFloat(prev[1]) || 0 : 0
    const delta = Math.round((it.value - current) / 100 * (tbl.base || 0))
    return [it.label, current + '%', it.value + '%', (delta > 0 ? '+' : '') + delta]
  })
}

// ---------- 导出 ----------
async function exportWord () {
  if (notDone.value.length) {
    flash(`还有 ${notDone.value.length} 个模块未生成（${notDone.value.map(m => libraryItem(m.type).name).join('、')}），请先生成或删除后再导出。`, 'warn')
    return
  }
  const badPie = state.mods.find(m => m.blocks.some(b => b.type === 'pie' && Math.abs(b.items.reduce((s, i) => s + (Number(i.value) || 0), 0) - 100) >= 0.01))
  if (badPie) {
    flash(`「${libraryItem(badPie.type).name}」中饼图各分类合计不等于 100%，请调整后再导出。`, 'warn')
    state.sel = badPie.uid
    return
  }
  state.exporting = true
  try {
    const blob = await buildDocx(state.mods, { clientName: client.name })
    const d = new Date()
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    saveAs(blob, `财富规划建议书_${client.name}_${stamp}.docx`)
    flash(`已按当前 ${state.mods.length} 个模块的顺序导出 Word。`, 'ok')
  } catch (err) {
    console.error(err)
    flash('导出失败：' + err.message, 'warn')
  } finally {
    state.exporting = false
  }
}

onMounted(() => {
  // 演示：进入页面时自动生成封面和客户画像，其余模块等待用户逐个生成
  state.mods.filter(m => m.type === 'cover' || m.type === 'profile').forEach(generate)
})
</script>

<template>
  <div class="app" :class="{ 'is-preview': state.preview }">
    <header class="topbar">
      <div class="topbar-left">
        <div class="logo" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>
        </div>
        <div class="title">
          <span class="t1">财富规划建议书</span>
          <span class="t2">客户：{{ client.name }} · 示例数据</span>
        </div>
        <label class="field-inline">模板
          <select>
            <option>标准版建议书</option>
            <option>高净值家庭版</option>
            <option>养老规划专版</option>
          </select>
        </label>
      </div>
      <div class="topbar-right">
        <span class="muted">已生成 {{ doneCount }} / {{ state.mods.length }} 个模块</span>
        <button v-if="!state.preview" type="button" class="btn" @click="generateAll">一键生成待生成模块</button>
        <div v-if="state.preview" class="seg" role="group" aria-label="缩放">
          <button v-for="z in [0.75, 1, 1.25]" :key="z" type="button" :aria-pressed="state.zoom === z" :class="{ on: state.zoom === z }" @click="state.zoom = z">{{ z * 100 }}%</button>
        </div>
        <button type="button" class="btn" :class="{ dark: state.preview }" :aria-pressed="state.preview" @click="state.preview = !state.preview; state.confirmUid = null">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
          {{ state.preview ? '退出预览' : '预览' }}
        </button>
        <button type="button" class="btn primary" :disabled="state.exporting" @click="exportWord">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
          {{ state.exporting ? '正在导出…' : '导出 Word' }}
        </button>
      </div>
    </header>

    <div v-if="state.toast" role="status" class="toast" :class="'toast-' + state.toast.kind">{{ state.toast.text }}</div>

    <div class="layout">
      <!-- 模块库 -->
      <aside v-if="!state.preview" class="panel lib" aria-label="模块库">
        <div class="panel-head">
          <h2>模块库</h2>
          <span class="muted">拖入右侧文档，或点击添加</span>
        </div>
        <button
          v-for="l in libItems" :key="l.type" type="button" class="lib-item"
          :disabled="l.disabled" :draggable="!l.disabled"
          @dragstart="onLibDragStart($event, l.type)" @dragend="onDragEnd"
          @click="insertModule(l.type, defaultInsertIndex(l.type))"
        >
          <span class="lib-no" aria-hidden="true">{{ l.no }}</span>
          <span class="lib-text">
            <span class="lib-name">{{ l.name }}<span v-if="l.required" class="req"> · 必选</span></span>
            <span class="lib-desc">{{ l.desc }}</span>
          </span>
        </button>
      </aside>

      <!-- 文档 -->
      <main class="doc-col" aria-label="建议书文档">
        <div v-if="state.preview" class="preview-bar">
          <span>预览模式 · 只读</span>
          <span :class="notDone.length ? 'warn-text' : 'ok-text'">
            {{ notDone.length ? `${notDone.length} 个模块未生成，导出前需处理` : '全部模块已生成，可导出' }}
          </span>
        </div>
        <div class="paper" :style="{ zoom: state.preview ? state.zoom : 1 }" @dragover.prevent="onDragOverAt(state.mods.length)" @drop.prevent="onDropAt(state.mods.length)">
          <div v-if="state.preview" class="running-head">
            <span>{{ client.org }} · 家庭财富规划建议书</span><span>{{ client.name }} · {{ client.date }}</span>
          </div>

          <template v-for="(m, i) in state.mods" :key="m.uid">
            <div v-if="!state.preview" class="drop-line" :class="{ on: state.dropHint === i }" @dragover.prevent.stop="onDragOverAt(i)" @drop.prevent.stop="onDropAt(i)"></div>
            <article
              class="mod"
              :class="{ sel: state.sel === m.uid && !state.preview, flat: state.preview, cover: m.type === 'cover' }"
              :draggable="!state.preview"
              @dragstart="onModDragStart($event, i)" @dragend="onDragEnd"
              @dragover.prevent.stop="onDragOverAt(i)" @drop.prevent.stop="onDropAt(i)"
              @click="!state.preview && (state.sel = m.uid)"
            >
              <div v-if="!state.preview" class="mod-bar">
                <div class="mod-bar-l">
                  <span class="grip" title="拖动排序" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
                  </span>
                  <span class="muted">模块 {{ i + 1 }} · {{ libraryItem(m.type).name }}</span>
                  <span class="chip" :class="statusOf(m).cls">{{ statusOf(m).text }}</span>
                  <span v-if="libraryItem(m.type).required" class="req">必选</span>
                </div>
                <div class="mod-bar-r">
                  <button v-if="m.status !== 'generating'" type="button" class="btn sm"
                    :class="{ primary: m.status !== 'done', confirm: state.confirmUid === m.uid }"
                    @click.stop="generate(m)">
                    {{ m.status !== 'done' ? (m.status === 'error' ? '重试' : '生成') : (state.confirmUid === m.uid ? '确认覆盖修改？' : '重新生成') }}
                  </button>
                  <button type="button" class="ibtn" :disabled="i === 0" aria-label="上移" @click.stop="moveModule(i, i - 1)">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
                  </button>
                  <button type="button" class="ibtn" :disabled="i === state.mods.length - 1" aria-label="下移" @click.stop="moveModule(i, i + 2)">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14" /><path d="M5 12l7 7 7-7" /></svg>
                  </button>
                  <button type="button" class="ibtn" :disabled="libraryItem(m.type).required" aria-label="删除模块" @click.stop="removeModule(m)">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></svg>
                  </button>
                </div>
              </div>

              <div v-if="m.status === 'pending' || m.status === 'error'" :class="state.preview ? 'ph-warn' : 'ph'">
                <template v-if="state.preview">【{{ libraryItem(m.type).name }}】尚未生成，导出 Word 前请先生成或删除该模块</template>
                <template v-else>此模块尚未生成 · 点击「生成」，将读取客户数据并生成本模块内容</template>
              </div>
              <div v-else-if="m.status === 'generating'" class="ph-gen">
                <span>正在读取客户数据并生成内容…</span>
                <div class="sk" style="width: 92%"></div><div class="sk" style="width: 76%"></div><div class="sk" style="width: 84%"></div>
              </div>
              <div v-else class="content">
                <BlockView
                  v-for="(b, bi) in m.blocks" :key="m.uid + '-' + bi"
                  :block="b" :editable="!state.preview"
                  :num="b.type === 'h' ? chapterNums[m.uid] : ''"
                  @edited="m.edited = true"
                  @pie-changed="syncPieTable(m)"
                />
              </div>
            </article>
          </template>

          <div v-if="!state.preview" class="drop-end" :class="{ on: state.dropHint === state.mods.length }">将左侧模块拖到此处，或拖到两个模块之间插入</div>
          <div v-if="state.preview" class="running-foot">
            <span>本建议书仅供 {{ client.name }} 本人参考，请勿外传</span><span>共 {{ state.mods.length }} 个模块</span>
          </div>
        </div>
      </main>

      <!-- 设置 -->
      <aside v-if="!state.preview" class="panel settings" aria-label="模块设置">
        <div class="panel-head">
          <h2>模块设置</h2>
          <span class="muted">{{ current ? `当前：${libraryItem(current.type).name} · ${statusOf(current).text}` : '点击文档中的模块进行设置' }}</span>
        </div>
        <template v-if="current">
          <div class="field">
            <span class="label">数据来源</span>
            <span class="value">{{ libraryItem(current.type).source }}</span>
          </div>
          <label class="field">
            <span class="label">文字风格</span>
            <select v-model="current.opts.tone">
              <option>专业严谨</option><option>通俗易懂</option><option>简洁要点</option>
            </select>
          </label>
          <label class="field">
            <span class="label">补充说明（参与生成）</span>
            <textarea v-model="current.opts.note" rows="3" placeholder="如：客户更关注教育金确定性"></textarea>
          </label>
          <p class="hint">修改风格或补充说明后，点击模块上的「重新生成」生效。已人工修改的模块重新生成前需要二次确认。</p>
        </template>
        <div class="outline">
          <span class="label">文档结构</span>
          <button v-for="(m, i) in state.mods" :key="m.uid" type="button" class="outline-item" @click="state.sel = m.uid">
            <span>{{ i + 1 }}. {{ libraryItem(m.type).name }}</span>
            <span class="dot" :class="statusOf(m).cls" aria-hidden="true"></span>
          </button>
        </div>
        <div class="hint">
          <strong>Word 导出说明</strong><br>
          导出时按当前模块顺序生成 .docx：标题与下段同页、表格行不跨页、表头跨页重复、图表与图题同页，减少跳页；页眉页脚和页码自动生成。
        </div>
      </aside>
    </div>
  </div>
</template>
