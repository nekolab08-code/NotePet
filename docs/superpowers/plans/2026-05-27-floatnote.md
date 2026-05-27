# Floating Note Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline note editor with draggable floating note windows, and redesign note cards to show content preview with date.

**Architecture:** Pure renderer-side changes — no new IPC channels, no main.js changes. `floatNoteMap (Map<noteId, HTMLElement>)` tracks open windows. `mousemove` guard extended to suppress click-through auto-toggle while any float window is open.

**Tech Stack:** Electron 29, Vanilla JS, CSS (no frameworks)

> **Note on TDD:** All changes are Electron renderer UI — no pure functions to unit test. Each task uses manual visual verification via `npm start` instead of Jest.

---

## File Map

| File | Changes |
|---|---|
| `renderer/style.css` | Redesign `.note-card`; add `.floatnote-*` styles |
| `renderer/app.js` | Remove `editingNoteId`, `buildNoteEditor`; rewrite `buildNoteCard`; add `openFloatNote`, `bringFloatToFront`, `formatCardDate`, `floatNoteMap`, `floatZCounter`, `_floatOffset` |

---

## Task 1: CSS — Note Card Redesign + Floatnote Styles

**Files:**
- Modify: `renderer/style.css`

- [ ] **Step 1: Replace the `.note-card` block**

Find and replace the entire block from `.note-card {` through `.note-card-delete:hover { color: #e00; }` (lines 59–73) with:

```css
.note-card {
  background: #fff;
  padding: 10px 12px;
  border-left: 3px solid #f0c040;
  border-bottom: 1px solid #f0e8a0;
  border-radius: 0;
  display: flex; flex-direction: column; gap: 4px;
  cursor: default;
}
.note-card:hover { background: #fffae0; }
.note-card:hover .note-card-delete { opacity: 1; }
.note-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; }
.note-card-title { font-weight: bold; font-size: 13px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note-card-date { font-size: 10px; color: #aaa; white-space: nowrap; flex-shrink: 0; }
.note-card-meta { font-size: 11px; color: #888; }
.note-card-delete {
  background: none; border: none;
  color: #ccc; cursor: pointer; font-size: 16px; padding: 0 4px;
  opacity: 0; transition: opacity .15s; flex-shrink: 0;
}
.note-card-delete:hover { color: #e00; }
.note-card-preview {
  font-size: 12px; color: #666; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  overflow: hidden;
}
```

- [ ] **Step 2: Append floatnote styles at end of file**

After the last line (`#error-toast.show { opacity: 1; }`), append:

```css
#note-list { display: flex; flex-direction: column; }

.floatnote {
  position: fixed;
  width: 280px;
  background: #fffde7;
  border: 1px solid #f0c040;
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0,0,0,.35);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.floatnote-titlebar {
  background: #f0c040;
  padding: 7px 10px;
  display: flex; justify-content: space-between; align-items: center;
  cursor: move; user-select: none;
}
.floatnote-title-text {
  font-size: 13px; font-weight: bold; color: #333;
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.floatnote-close {
  background: none; border: none; font-size: 18px; color: #333;
  cursor: pointer; line-height: 1; padding: 0 0 0 8px; flex-shrink: 0;
}
.floatnote-close:hover { color: #c00; }
.floatnote-body {
  padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
  overflow-y: auto; max-height: calc(100vh - 140px);
}
.floatnote-title-input {
  width: 100%; padding: 4px 6px;
  border: none; border-bottom: 2px solid #f0c040;
  background: transparent; font-size: 14px; font-weight: bold;
  font-family: inherit; outline: none;
}
.floatnote-content {
  width: 100%; min-height: 100px; resize: vertical;
  border: 1px solid #e0d090; border-radius: 4px;
  padding: 6px 8px; font-size: 13px; font-family: inherit;
  background: #fff; outline: none;
}
.floatnote-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.floatnote-actions { display: flex; gap: 6px; justify-content: flex-end; }
.floatnote-btn-cancel {
  background: #eee; border: none; border-radius: 6px;
  padding: 5px 14px; cursor: pointer; font-size: 12px; font-family: inherit;
}
.floatnote-btn-save {
  background: #f0c040; border: none; border-radius: 6px;
  padding: 5px 14px; cursor: pointer; font-size: 12px; font-family: inherit;
}
```

- [ ] **Step 3: Commit**

```bash
git add renderer/style.css
git commit -m "style: redesign note card and add floatnote CSS"
```

---

## Task 2: JS — Global State + Guards Cleanup

**Files:**
- Modify: `renderer/app.js`

- [ ] **Step 1: Replace global vars block**

Find (lines 31–35):
```js
let state = null
let panelOpen = false
let activeTagFilter = null
let editingNoteId = null
let _mouseIgnored = true
```

Replace with:
```js
let state = null
let panelOpen = false
let activeTagFilter = null
let _mouseIgnored = true
const floatNoteMap = new Map()
let floatZCounter = 1000
let _floatOffset = 0
```

- [ ] **Step 2: Update mousemove guard**

Find:
```js
document.addEventListener('mousemove', e => {
  if (panelOpen) return  // togglePanel manages ignoreMouseEvents while panel is open
```

Replace with:
```js
document.addEventListener('mousemove', e => {
  if (panelOpen || floatNoteMap.size > 0) return
```

- [ ] **Step 3: Update closePanel — remove editingNoteId guard**

Find:
```js
function closePanel(force = false) {
  if (!panelOpen) return
  if (editingNoteId !== null && !force) return
  panelOpen = false
  _mouseIgnored = true
  window.notepet.togglePanel(false)
  document.getElementById('panel').classList.add('hidden')
  document.getElementById('overlay').classList.add('hidden')
  editingNoteId = null
  renderNoteList()
}
```

Replace with:
```js
function closePanel(force = false) {
  if (!panelOpen) return
  panelOpen = false
  _mouseIgnored = true
  window.notepet.togglePanel(false)
  document.getElementById('panel').classList.add('hidden')
  document.getElementById('overlay').classList.add('hidden')
  renderNoteList()
}
```

- [ ] **Step 4: Update renderNoteList — remove editingNoteId conditional**

Find:
```js
  visible.forEach(note => {
    list.appendChild(
      note.id === editingNoteId ? buildNoteEditor(note) : buildNoteCard(note)
    )
  })
```

Replace with:
```js
  visible.forEach(note => list.appendChild(buildNoteCard(note)))
```

- [ ] **Step 5: Remove editingNoteId reference from deleteNote**

Find:
```js
async function deleteNote(id) {
  state.notes = state.notes.filter(n => n.id !== id)
  if (editingNoteId === id) editingNoteId = null
  const result = await window.notepet.save(state)
```

Replace with:
```js
async function deleteNote(id) {
  state.notes = state.notes.filter(n => n.id !== id)
  const result = await window.notepet.save(state)
```

- [ ] **Step 6: Commit**

```bash
git add renderer/app.js
git commit -m "refactor: remove editingNoteId, add floatNoteMap globals, fix guards"
```

---

## Task 3: JS — Rewrite buildNoteCard + Remove buildNoteEditor

**Files:**
- Modify: `renderer/app.js`

- [ ] **Step 1: Replace buildNoteCard**

Find the entire `function buildNoteCard(note) { ... }` block and replace with:

```js
function formatCardDate(note) {
  if (!note.createdAt) return ''
  const d = new Date(note.createdAt)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
}

function buildNoteCard(note) {
  const card = document.createElement('div')
  card.className = 'note-card'

  const header = document.createElement('div')
  header.className = 'note-card-header'

  const titleEl = document.createElement('div')
  titleEl.className = 'note-card-title'
  titleEl.textContent = note.title || ''

  const dateEl = document.createElement('div')
  dateEl.className = 'note-card-date'
  dateEl.textContent = formatCardDate(note)

  const delBtn = document.createElement('button')
  delBtn.className = 'note-card-delete'
  delBtn.textContent = '×'
  delBtn.addEventListener('click', e => { e.stopPropagation(); deleteNote(note.id) })

  header.appendChild(titleEl)
  header.appendChild(dateEl)
  header.appendChild(delBtn)
  card.appendChild(header)

  const preview = document.createElement('div')
  preview.className = 'note-card-preview'
  preview.textContent = note.content || ''
  card.appendChild(preview)

  const tagPart = (note.tags || []).join(', ')
  const hasReminder = note.reminder?.enabled && !note.reminder?.notified
  if (tagPart || hasReminder) {
    const meta = document.createElement('div')
    meta.className = 'note-card-meta'
    const reminderPart = hasReminder
      ? (tagPart ? ' · ' : '') + '⏰ ' + new Date(note.reminder.datetime).toLocaleString('zh-TW', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          hour12: (state.settings?.timeFormat ?? '24') === '12',
        })
      : ''
    meta.textContent = tagPart + reminderPart
    card.appendChild(meta)
  }

  card.addEventListener('dblclick', () => openFloatNote(note, false))
  return card
}
```

- [ ] **Step 2: Remove buildNoteEditor**

Find the entire section:
```js
// ── Note editor ───────────────────────────────────────────────────────────────

function buildNoteEditor(note) {
```
through the closing `}` before:
```js
// ── saveNote — YOUR TURN ──────────────────────────────────────────────────────
```

Delete that entire block (~120 lines).

- [ ] **Step 3: Verify app starts — cards show new style**

```bash
npm start
```

Expected: Panel shows cards with gold left border, content preview, date. No inline editor when clicking cards (click does nothing). Double-click should show an error in console (openFloatNote not yet defined) — that's OK for now.

- [ ] **Step 4: Commit**

```bash
git add renderer/app.js
git commit -m "feat: rewrite buildNoteCard with preview/date, add formatCardDate, remove buildNoteEditor"
```

---

## Task 4: JS — openFloatNote + bringFloatToFront

**Files:**
- Modify: `renderer/app.js`

- [ ] **Step 1: Add openFloatNote before the deleteNote function**

Insert the following two functions before `// ── Note deletion ─────`:

```js
// ── Floating note window ──────────────────────────────────────────────────────

function bringFloatToFront(el) {
  el.style.zIndex = ++floatZCounter
}

function openFloatNote(note, isNew = false) {
  if (floatNoteMap.has(note.id)) {
    bringFloatToFront(floatNoteMap.get(note.id))
    return
  }

  // Position with cascade offset, reset if out of bounds
  const baseX = Math.floor(window.innerWidth / 2) - 140
  const baseY = 80
  let x = baseX + _floatOffset * 20
  let y = baseY + _floatOffset * 20
  if (x + 280 + 10 > window.innerWidth || y + 400 + 10 > window.innerHeight) {
    _floatOffset = 0
    x = baseX; y = baseY
  }
  _floatOffset++

  const el = document.createElement('div')
  el.className = 'floatnote'
  el.style.left = x + 'px'
  el.style.top  = y + 'px'
  el.style.zIndex = ++floatZCounter
  el.addEventListener('mousedown', () => bringFloatToFront(el))

  // ── Title bar ──
  const titlebar = document.createElement('div')
  titlebar.className = 'floatnote-titlebar'
  const titleText = document.createElement('span')
  titleText.className = 'floatnote-title-text'
  titleText.textContent = note.title || '新筆記'
  const closeBtn = document.createElement('button')
  closeBtn.className = 'floatnote-close'
  closeBtn.textContent = '×'
  titlebar.appendChild(titleText)
  titlebar.appendChild(closeBtn)

  // ── Body ──
  const body = document.createElement('div')
  body.className = 'floatnote-body'

  const titleInput = document.createElement('input')
  titleInput.type = 'text'
  titleInput.className = 'floatnote-title-input'
  titleInput.placeholder = '標題'
  titleInput.value = note.title || ''
  titleInput.addEventListener('input', () => {
    titleText.textContent = titleInput.value.trim() || '新筆記'
  })

  const contentInput = document.createElement('textarea')
  contentInput.className = 'floatnote-content'
  contentInput.placeholder = '輸入內容...'
  contentInput.value = note.content || ''

  // Tags
  const selectedTags = new Set(note.tags || [])
  const tagWrap = document.createElement('div')
  tagWrap.className = 'floatnote-tags'
  state.tags.forEach(tag => {
    const pill = document.createElement('button')
    pill.type = 'button'
    pill.className = 'tag-btn' + (selectedTags.has(tag) ? ' active' : '')
    pill.textContent = tag
    pill.addEventListener('click', () => {
      selectedTags.has(tag) ? selectedTags.delete(tag) : selectedTags.add(tag)
      pill.classList.toggle('active')
    })
    tagWrap.appendChild(pill)
  })

  // Reminder
  const reminderRow = document.createElement('div')
  reminderRow.style.cssText = 'display:flex;align-items:center;gap:8px'
  const switchWrap = document.createElement('label')
  switchWrap.className = 'toggle-switch'
  const reminderCb = document.createElement('input')
  reminderCb.type = 'checkbox'
  reminderCb.checked = !!(note.reminder?.enabled)
  const slider = document.createElement('span')
  slider.className = 'toggle-slider'
  switchWrap.appendChild(reminderCb)
  switchWrap.appendChild(slider)
  const reminderText = document.createElement('span')
  reminderText.style.cssText = 'font-size:12px;cursor:pointer'
  reminderText.textContent = '設定提醒'
  reminderText.addEventListener('click', () => {
    reminderCb.checked = !reminderCb.checked
    reminderCb.dispatchEvent(new Event('change'))
  })
  reminderRow.appendChild(switchWrap)
  reminderRow.appendChild(reminderText)

  const reminderDetails = document.createElement('div')
  reminderDetails.style.cssText = 'display:flex;flex-direction:column;gap:4px'
  reminderDetails.style.display = reminderCb.checked ? 'flex' : 'none'

  const datetimeInput = document.createElement('input')
  datetimeInput.type = 'datetime-local'
  datetimeInput.value = note.reminder?.datetime ? note.reminder.datetime.slice(0, 16) : ''
  datetimeInput.style.cssText = 'width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;font-family:inherit'

  const intervalSelect = document.createElement('select')
  intervalSelect.style.cssText = 'width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;font-family:inherit'
  ;[[0,'不重複'],[30,'每30分鐘'],[60,'每小時'],[120,'每2小時'],[240,'每4小時']].forEach(([val, label]) => {
    const opt = document.createElement('option')
    opt.value = val; opt.textContent = label
    if ((note.reminder?.interval ?? 0) === val) opt.selected = true
    intervalSelect.appendChild(opt)
  })

  const advanceRow = document.createElement('div')
  advanceRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px'
  advanceRow.appendChild(document.createTextNode('提前'))
  const advanceInput = document.createElement('input')
  advanceInput.type = 'number'; advanceInput.min = '0'; advanceInput.max = '1440'
  advanceInput.value = note.reminder?.advanceMinutes ?? 10
  advanceInput.style.cssText = 'width:52px;padding:2px 4px;border:1px solid #ddd;border-radius:4px;font-size:12px'
  advanceRow.appendChild(advanceInput)
  advanceRow.appendChild(document.createTextNode('分鐘提醒'))

  reminderCb.addEventListener('change', () => {
    reminderDetails.style.display = reminderCb.checked ? 'flex' : 'none'
  })
  reminderDetails.appendChild(datetimeInput)
  reminderDetails.appendChild(intervalSelect)
  reminderDetails.appendChild(advanceRow)

  // Buttons
  const actions = document.createElement('div')
  actions.className = 'floatnote-actions'
  const cancelBtn = document.createElement('button')
  cancelBtn.className = 'floatnote-btn-cancel'
  cancelBtn.textContent = '取消'
  const saveBtn = document.createElement('button')
  saveBtn.className = 'floatnote-btn-save'
  saveBtn.textContent = '儲存'

  const closeFloat = () => {
    floatNoteMap.delete(note.id)
    el.remove()
    renderNoteList()
  }

  cancelBtn.addEventListener('click', () => {
    if (isNew && !titleInput.value.trim() && !contentInput.value.trim()) {
      state.notes = state.notes.filter(n => n.id !== note.id)
    }
    closeFloat()
  })
  closeBtn.addEventListener('click', () => cancelBtn.click())

  saveBtn.addEventListener('click', async () => {
    const ok = await saveNote(note, {
      title:            titleInput.value.trim(),
      content:          contentInput.value.trim(),
      tags:             Array.from(selectedTags),
      reminderEnabled:  reminderCb.checked,
      reminderDatetime: datetimeInput.value,
      reminderInterval: parseInt(intervalSelect.value),
      reminderAdvance:  Math.max(0, parseInt(advanceInput.value) || 0),
    })
    if (ok) closeFloat()
  })

  actions.appendChild(cancelBtn)
  actions.appendChild(saveBtn)

  // Assemble
  body.appendChild(titleInput)
  body.appendChild(contentInput)
  if (state.tags.length) body.appendChild(tagWrap)
  body.appendChild(reminderRow)
  body.appendChild(reminderDetails)
  body.appendChild(actions)
  el.appendChild(titlebar)
  el.appendChild(body)

  // Drag
  let dragging = false, ox = 0, oy = 0
  titlebar.addEventListener('mousedown', e => {
    dragging = true
    ox = e.clientX - el.offsetLeft
    oy = e.clientY - el.offsetTop
    bringFloatToFront(el)
    e.preventDefault()
  })
  document.addEventListener('mousemove', e => {
    if (!dragging) return
    const margin = 10
    const nx = Math.min(Math.max(e.clientX - ox, margin), window.innerWidth  - 280 - margin)
    const ny = Math.min(Math.max(e.clientY - oy, margin), window.innerHeight - 100 - margin)
    el.style.left = nx + 'px'
    el.style.top  = ny + 'px'
  })
  document.addEventListener('mouseup', () => { dragging = false })

  document.body.appendChild(el)
  floatNoteMap.set(note.id, el)
  setTimeout(() => contentInput.focus(), 50)
}
```

- [ ] **Step 2: Verify floating note opens on double-click**

```bash
npm start
```

Expected:
- Double-click a note card → floating window appears at center-top
- Window is draggable by gold title bar
- × and 取消 close the window
- 儲存 saves and closes
- Double-clicking same card again brings window to front (not a duplicate)
- Multiple cards double-clicked → multiple floating windows, each draggable

- [ ] **Step 3: Commit**

```bash
git add renderer/app.js
git commit -m "feat: openFloatNote — draggable floating note windows with full editor"
```

---

## Task 5: JS — Wire addNote + Clean saveNote

**Files:**
- Modify: `renderer/app.js`

- [ ] **Step 1: Update addNote**

Find:
```js
async function addNote() {
  const newNote = {
    id:      window.notepet.newId(),
    title:   '',
    content: '',
    tags:    [],
    reminder: { enabled: false, datetime: '', notified: false, interval: 0, advanceMinutes: 10 },
  }
  state.notes.unshift(newNote)
  editingNoteId = newNote.id
  renderNoteList()
}
```

Replace with:
```js
async function addNote() {
  const newNote = {
    id:        window.notepet.newId(),
    title:     '',
    content:   '',
    tags:      [],
    reminder:  { enabled: false, datetime: '', notified: false, interval: 0, advanceMinutes: 10 },
    createdAt: new Date().toISOString(),
  }
  state.notes.unshift(newNote)
  renderNoteList()
  openFloatNote(newNote, true)
}
```

- [ ] **Step 2: Remove editingNoteId = null from saveNote; add return true**

Find (near end of saveNote):
```js
  const result = await window.notepet.save(state)
  if (result && result.error) { showError('儲存失敗：' + result.error); return }

  editingNoteId = null
  renderNoteList()
}
```

Replace with:
```js
  const result = await window.notepet.save(state)
  if (result && result.error) { showError('儲存失敗：' + result.error); return }

  renderNoteList()
  return true
}
```

> `return true` lets callers (`openFloatNote`'s save button) know the save succeeded. All early-exit paths return `undefined` (falsy), so `if (ok) closeFloat()` only closes on success.

- [ ] **Step 3: Verify end-to-end**

```bash
npm start
```

Checklist:
- [ ] Click 「新增」→ floating window opens immediately, empty, cursor in content
- [ ] Type title and content → title bar updates live
- [ ] 儲存 → note saved, card appears in panel with content preview and today's date
- [ ] 取消 on empty new note → card disappears (deleted)
- [ ] 取消 after typing → no save, card still in list (note wasn't new = false logic — but wait, here isNew=true so it would delete if empty. Since the user typed something, `titleInput.value.trim()` is not empty so it won't delete.) ✓
- [ ] Old notes (without createdAt) → no date shown on card ✓
- [ ] Escape → closes panel, floating windows stay open ✓
- [ ] Panel closes → floatNoteMap.size > 0 → no click-through issues, windows still interactive ✓

- [ ] **Step 4: Commit**

```bash
git add renderer/app.js
git commit -m "feat: wire addNote to openFloatNote, add createdAt, clean saveNote"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Run all unit tests**

```bash
npm test
```

Expected: All 17 tests PASS (data, writeQueue, reminder — none were changed)

- [ ] **Step 2: Full scenario test**

```bash
npm start
```

| Scenario | Expected |
|---|---|
| 雙擊卡片 | 浮動視窗在卡片前方出現 |
| 多張並排 | 每張獨立拖移，不互相干擾 |
| 雙擊同一張第二次 | 已開啟的視窗移到最前 |
| 新增後取消（空白） | 筆記從列表消失 |
| 新增後取消（有內容） | 筆記保留（title/content 至少一個非空） |
| Escape | 面板關閉，浮動視窗留著 |
| 拖移浮動視窗到螢幕邊緣 | 不超出邊界（10px margin） |
| 開多張 → 全部關閉 → 移到透明區 | setIgnoreMouse 恢復正常（桌面可點擊） |

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: floatnote feature complete — draggable floating note windows"
```
