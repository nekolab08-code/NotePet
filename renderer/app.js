const PANEL_W = 280
const PANEL_H = 360

const THEMES = {
  default: { bg: '#fffde7', accent: '#f0c040', accentDark: '#d4a800', border: '#f0c040', card: '#fff', cardHover: '#fff9e0', meta: '#888', text: '#333' },
  dark:    { bg: '#1e1e2e', accent: '#89b4fa', accentDark: '#74a8f5', border: '#45475a', card: '#313244', cardHover: '#3d3f55', meta: '#a6adc8', text: '#cdd6f4' },
  mint:    { bg: '#f0fff4', accent: '#48bb78', accentDark: '#38a169', border: '#9ae6b4', card: '#fff',    cardHover: '#e6ffed', meta: '#5a8a7a', text: '#1a4731' },
  rose:    { bg: '#fff0f3', accent: '#f687b3', accentDark: '#ed64a6', border: '#fbb6ce', card: '#fff',    cardHover: '#fff0f3', meta: '#a0607a', text: '#702459' },
}

function applySettings(s) {
  const t = THEMES[s.theme] || THEMES.default
  let el = document.getElementById('dynamic-theme')
  if (!el) { el = document.createElement('style'); el.id = 'dynamic-theme'; document.head.appendChild(el) }
  el.textContent = `
    #panel { background:${t.bg};border-color:${t.border};font-size:${s.fontSize}px;font-family:'${s.fontFamily}',sans-serif;color:${t.text}; }
    #pet-img { opacity:${s.petOpacity ?? 1}; }
    .note-card { background:${t.card};border-color:${t.border}; }
    .note-card:hover { background:${t.cardHover}; }
    .note-card-title { color:${t.text}; }
    .note-card-meta { color:${t.meta}; }
    .note-editor { background:${t.card};border-color:${t.border}; }
    #btn-add,#btn-manage-tags { background:${t.accent}; }
    #btn-add:hover,#btn-manage-tags:hover { background:${t.accentDark}; }
    .tag-btn.active { background:${t.accent};border-color:${t.accentDark}; }
    .toggle-switch input:checked + .toggle-slider { background:${t.accent}; }
    .modal-btn-primary { background:${t.accent}; }
  `
}

let state = null
let panelOpen = false
let activeTagFilter = null
let _mouseIgnored = true
const floatNoteMap = new Map()
let floatZCounter = 1000
let _floatOffset = 0

document.addEventListener('mousemove', e => {
  if (panelOpen || floatNoteMap.size > 0) return
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const transparent = !el || el === document.body || el === document.documentElement
  if (transparent !== _mouseIgnored) {
    _mouseIgnored = transparent
    window.notepet.setIgnoreMouse(transparent)
  }
})

const DEFAULT_SETTINGS = { fontSize: 14, fontFamily: 'Microsoft JhengHei', theme: 'default' }

let _petImgSrc = '../assets/default-pet.png'
async function setPetImage(imgPath) {
  const resolved = await window.notepet.resolveImage(imgPath)
  _petImgSrc = resolved || ('../' + imgPath)
  document.getElementById('pet-img').src = _petImgSrc
}

async function init() {
  state = await window.notepet.load()
  applySettings(state.settings || DEFAULT_SETTINGS)

  const panel = document.getElementById('panel')
  const ps = state.settings?.panelSize
  if (ps) { panel.style.width = ps.width + 'px'; panel.style.height = ps.height + 'px' }

  const pet = document.getElementById('pet-container')

  // If petPosition is null (first launch), compute default bottom-right position
  // and persist it immediately so subsequent launches read a real value
  if (state.petPosition.x === null) {
    state.petPosition = {
      x: window.innerWidth  - 80 - 20,
      y: window.innerHeight - 80 - 20,
    }
    window.notepet.movePet(state.petPosition)
  }

  pet.style.left = state.petPosition.x + 'px'
  pet.style.top  = state.petPosition.y + 'px'
  await setPetImage(state.petImage)

  setupDrag(pet)
  setupPetClick(pet)
  document.getElementById('overlay').addEventListener('click', () => closePanel())
  window.addEventListener('blur', () => closePanel())
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(true) })
  document.getElementById('btn-add').addEventListener('click', addNote)
  document.getElementById('panel-gear').addEventListener('click', openSettingsModal)
  renderTagFilter()
  renderNoteList()
}

function setupDrag(pet) {
  let dragging = false, ox = 0, oy = 0
  const img = document.getElementById('pet-img')

  pet.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    dragging = true
    ox = e.clientX - pet.offsetLeft
    oy = e.clientY - pet.offsetTop
    img.src = '../assets/pinch-pet.png'
    e.preventDefault()
  })

  document.addEventListener('mousemove', e => {
    if (!dragging) return
    const margin = 20
    const x = Math.min(Math.max(e.clientX - ox, margin), window.innerWidth  - 80 - margin)
    const y = Math.min(Math.max(e.clientY - oy, margin), window.innerHeight - 80 - margin)
    pet.style.left = x + 'px'
    pet.style.top  = y + 'px'
  })

  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    const x = parseInt(pet.style.left)
    const y = parseInt(pet.style.top)
    state.petPosition = { x, y }
    window.notepet.movePet({ x, y })
    img.src = _petImgSrc
  })
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function showError(msg) {
  const t = document.getElementById('error-toast')
  t.textContent = msg
  t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), 3000)
}

function setupPetClick(pet) {
  pet.addEventListener('click', () => panelOpen ? closePanel(true) : openPanel())
  pet.addEventListener('contextmenu', e => { e.preventDefault(); showPetContextMenu(e) })
}

function openPanel() {
  panelOpen = true
  _mouseIgnored = false
  window.notepet.togglePanel(true)
  const panel = document.getElementById('panel')
  panel.classList.remove('hidden')
  document.getElementById('overlay').classList.remove('hidden')
  positionPanel()  // After reveal so offsetWidth is accurate
}

function closePanel(force = false) {
  if (!panelOpen) return
  panelOpen = false
  _mouseIgnored = true
  window.notepet.togglePanel(false)
  document.getElementById('panel').classList.add('hidden')
  document.getElementById('overlay').classList.add('hidden')
  renderNoteList()
}

let _panelPos = null

function calcQuadrant(px, py, vw, vh, pw, ph) {
  const goLeft  = px + 40 > vw / 2
  const goAbove = py + 40 > vh / 2
  return {
    x: Math.max(0, Math.min(goLeft  ? px - pw - 4 : px + 84, vw - pw)),
    y: Math.max(0, Math.min(goAbove ? py - ph - 4 : py + 84, vh - ph)),
  }
}

function positionPanel() {
  const pet   = document.getElementById('pet-container')
  const panel = document.getElementById('panel')
  const px = parseInt(pet.style.left)
  const py = parseInt(pet.style.top)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const pw = panel.offsetWidth  || state.settings?.panelSize?.width  || PANEL_W
  const ph = panel.offsetHeight || state.settings?.panelSize?.height || PANEL_H
  const jitter = () => Math.round((Math.random() - 0.5) * 20)

  let x, y
  if (_panelPos) {
    const nx = _panelPos.x + jitter()
    const ny = _panelPos.y + jitter()
    const cx = Math.max(0, Math.min(nx, vw - pw))
    const cy = Math.max(0, Math.min(ny, vh - ph))
    if (Math.abs(cx - nx) > 40 || Math.abs(cy - ny) > 40) {
      ({ x, y } = calcQuadrant(px, py, vw, vh, pw, ph))
    } else {
      x = cx; y = cy
    }
  } else {
    ({ x, y } = calcQuadrant(px, py, vw, vh, pw, ph))
  }

  panel.style.left = x + 'px'
  panel.style.top  = y + 'px'
  _panelPos = { x, y }
}

async function showPetContextMenu(e) {
  const items = ['更換搭子圖片', '關閉 NotePet']
  const action = await showContextMenu(items, e.clientX, e.clientY)
  if (action === '更換搭子圖片') {
    const result = await window.notepet.changeImage()
    if (result && result.path) {
      state.petImage = result.path
      await setPetImage(result.path)
    } else if (result && result.error) {
      showError('更換失敗：' + result.error)
    }
  } else if (action === '關閉 NotePet') {
    window.notepet.quit()
  }
}

function showContextMenu(items, x, y) {
  return new Promise(resolve => {
    const menu = document.createElement('div')
    menu.className = 'ctx-menu'
    menu.style.left = x + 'px'
    menu.style.top  = y + 'px'
    items.forEach(label => {
      const item = document.createElement('div')
      item.className = 'ctx-item'
      item.textContent = label
      item.addEventListener('click', () => { menu.remove(); resolve(label) })
      menu.appendChild(item)
    })
    document.body.appendChild(menu)
    setTimeout(() => {
      document.addEventListener('click', () => { menu.remove(); resolve(null) }, { once: true })
    }, 0)
  })
}

// ── Tag filter bar ────────────────────────────────────────────────────────────

function renderTagFilter() {
  const container = document.getElementById('tag-filter')
  container.innerHTML = ''

  const allBtn = makeTagBtn('全部', activeTagFilter === null)
  allBtn.addEventListener('click', () => { activeTagFilter = null; renderTagFilter(); renderNoteList() })
  container.appendChild(allBtn)

  state.tags.forEach(tag => {
    const btn = makeTagBtn(tag, activeTagFilter === tag)
    btn.addEventListener('click', () => { activeTagFilter = tag; renderTagFilter(); renderNoteList() })
    container.appendChild(btn)
  })
}

function makeTagBtn(label, active) {
  const btn = document.createElement('button')
  btn.className = 'tag-btn' + (active ? ' active' : '')
  btn.textContent = label
  return btn
}

// ── Note list ─────────────────────────────────────────────────────────────────

function renderNoteList() {
  const list = document.getElementById('note-list')
  list.innerHTML = ''

  const visible = activeTagFilter
    ? state.notes.filter(n => (n.tags || []).includes(activeTagFilter))
    : state.notes

  if (visible.length === 0) {
    const empty = document.createElement('div')
    empty.style.cssText = 'text-align:center;color:#bbb;font-size:12px;padding:8px 0'
    empty.textContent = '還沒有筆記'
    list.appendChild(empty)
    return
  }

  visible.forEach(note => list.appendChild(buildNoteCard(note)))
}

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
  const hasReminder = note.reminder?.enabled && !note.reminder?.notified && !!note.reminder?.datetime
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

// ── saveNote — YOUR TURN ──────────────────────────────────────────────────────
//
// Called when the user clicks 儲存 in the inline editor.
// `note` is the live note object inside state.notes (mutate it directly).
// `edits` shape: { title, content, tags, reminderEnabled, reminderDatetime }
//
// TODO: implement the save logic below (~8 lines).
//
// Parse title shorthand: components (date, time, title) may appear in any order.
// Supported date: M/D[(weekday)] or MMDD. Time: H:MM or H.MM [am|pm].
// Returns { title, datetime } on match, null otherwise.
function parseTitleShorthand(raw) {
  if (!raw.startsWith('-')) return null
  let s = raw.slice(1).trim()
  if (!s) return null

  // Extract time (required)
  const timeRe = /\b(\d{1,2})[:.](\d{2})\s*(am|pm)?/i
  const tm = s.match(timeRe)
  if (!tm) return null
  let h = parseInt(tm[1])
  const min = parseInt(tm[2])
  const ap = (tm[3] || '').toLowerCase()
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  s = s.replace(tm[0], '').trim()

  // Extract date (optional) — M/D[(weekday)] or compact MMDD
  const now = new Date()
  let month = now.getMonth(), day = now.getDate()
  const slashRe = /\b(\d{1,2})\/(\d{1,2})(?:\([^)]*\))?/
  const compactRe = /\b(\d{2})(\d{2})\b/
  if (s.includes('明天')) {
    const tmr = new Date(now); tmr.setDate(tmr.getDate() + 1)
    month = tmr.getMonth(); day = tmr.getDate()
    s = s.replace('明天', '').trim()
  } else if (s.includes('今天')) {
    s = s.replace('今天', '').trim()
  } else {
    const sm = s.match(slashRe)
    if (sm) {
      month = parseInt(sm[1]) - 1; day = parseInt(sm[2])
      s = s.replace(sm[0], '').trim()
    } else {
      const cm = s.match(compactRe)
      if (cm) {
        const mo = parseInt(cm[1]), d = parseInt(cm[2])
        if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
          month = mo - 1; day = d
          s = s.replace(cm[0], '').trim()
        }
      }
    }
  }

  const title = s.trim()
  if (!title) return null
  const dt = new Date(now.getFullYear(), month, day, h, min)
  if (isNaN(dt.getTime())) return null
  const pad = n => String(n).padStart(2, '0')
  return {
    title,
    datetime: `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(h)}:${pad(min)}`,
  }
}

async function saveNote(note, edits) {
  const parsed = parseTitleShorthand(edits.title)
  if (parsed) {
    edits.title = parsed.title
    edits.reminderEnabled  = true
    edits.reminderDatetime = parsed.datetime
  }
  if (!edits.title) { showError('標題不能為空'); return }

  note.title   = edits.title
  note.content = edits.content
  note.tags    = edits.tags

  const datetimeChanged = edits.reminderDatetime !== (note.reminder.datetime || '').slice(0, 16)
  note.reminder = {
    enabled:  edits.reminderEnabled,
    datetime: edits.reminderDatetime,
    notified:       edits.reminderEnabled && datetimeChanged ? false : note.reminder.notified,
    interval:       edits.reminderInterval ?? 0,
    advanceMinutes: edits.reminderAdvance ?? 10,
  }

  const result = await window.notepet.save(state)
  if (result && result.error) { showError('儲存失敗：' + result.error); return }

  renderNoteList()
}

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
  const onDragMove = e => {
    if (!dragging) return
    const margin = 10
    const nx = Math.min(Math.max(e.clientX - ox, margin), window.innerWidth  - 280 - margin)
    const ny = Math.min(Math.max(e.clientY - oy, margin), window.innerHeight - 100 - margin)
    el.style.left = nx + 'px'
    el.style.top  = ny + 'px'
  }
  const onDragUp = () => { dragging = false }
  titlebar.addEventListener('mousedown', e => {
    dragging = true
    ox = e.clientX - el.offsetLeft
    oy = e.clientY - el.offsetTop
    bringFloatToFront(el)
    e.preventDefault()
  })
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragUp)

  const closeFloat = () => {
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragUp)
    floatNoteMap.delete(note.id)
    el.remove()
    renderNoteList()
  }

  document.body.appendChild(el)
  floatNoteMap.set(note.id, el)
  setTimeout(() => contentInput.focus(), 50)
}

// ── Note deletion ─────────────────────────────────────────────────────────────

async function deleteNote(id) {
  state.notes = state.notes.filter(n => n.id !== id)
  const result = await window.notepet.save(state)
  if (result && result.error) showError('刪除失敗：' + result.error)
  renderNoteList()
}

// ── Add note ──────────────────────────────────────────────────────────────────

async function addNote() {
  const newNote = {
    id:      window.notepet.newId(),
    title:   '',
    content: '',
    tags:    [],
    reminder: { enabled: false, datetime: '', notified: false, interval: 0, advanceMinutes: 10 },
  }
  state.notes.unshift(newNote)
  renderNoteList()
}

// ── Tag manager ───────────────────────────────────────────────────────────────

async function openTagManager() {
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'

  const box = document.createElement('div')
  box.className = 'modal-box'

  const heading = document.createElement('p')
  heading.style.fontWeight = 'bold'
  heading.textContent = '管理標籤'

  const tagList = document.createElement('div')
  tagList.style.cssText = 'display:flex;flex-direction:column;gap:4px;max-height:120px;overflow-y:auto'

  const refreshTagList = () => {
    tagList.innerHTML = ''
    state.tags.forEach(tag => {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center'
      const lbl = document.createElement('span')
      lbl.style.fontSize = '13px'; lbl.textContent = tag
      const del = document.createElement('button')
      del.textContent = '刪除'
      del.style.cssText = 'background:#eee;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px'
      del.addEventListener('click', () => {
        state.tags = state.tags.filter(t => t !== tag)
        state.notes.forEach(n => { n.tags = (n.tags || []).filter(t => t !== tag) })
        refreshTagList()
      })
      row.appendChild(lbl); row.appendChild(del)
      tagList.appendChild(row)
    })
  }
  refreshTagList()

  const addRow = document.createElement('div')
  addRow.style.cssText = 'display:flex;gap:6px'
  const newInput = document.createElement('input')
  newInput.placeholder = '新增標籤'
  newInput.style.cssText = 'flex:1;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px'
  const addTagBtn = document.createElement('button')
  addTagBtn.textContent = '新增'
  addTagBtn.className = 'modal-btn-primary'
  addTagBtn.style.border = 'none'
  addTagBtn.addEventListener('click', () => {
    const val = newInput.value.trim()
    if (!val || state.tags.includes(val)) return
    state.tags.push(val)
    newInput.value = ''
    refreshTagList()
  })
  newInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTagBtn.click() })
  addRow.appendChild(newInput); addRow.appendChild(addTagBtn)

  const actions = document.createElement('div')
  actions.className = 'modal-actions'
  const doneBtn = document.createElement('button')
  doneBtn.textContent = '完成'
  doneBtn.className = 'modal-btn-primary'
  doneBtn.style.border = 'none'
  doneBtn.addEventListener('click', async () => {
    backdrop.remove()
    const result = await window.notepet.save(state)
    if (result && result.error) showError('儲存失敗：' + result.error)
    renderTagFilter()
    renderNoteList()
  })
  actions.appendChild(doneBtn)

  box.appendChild(heading)
  box.appendChild(tagList)
  box.appendChild(addRow)
  box.appendChild(actions)
  backdrop.appendChild(box)
  document.body.appendChild(backdrop)
}

// ── Settings modal ────────────────────────────────────────────────────────────

function openSettingsModal() {
  const saved = state.settings || DEFAULT_SETTINGS

  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'

  const box = document.createElement('div')
  box.className = 'modal-box'
  box.style.width = '240px'

  const heading = document.createElement('p')
  heading.style.fontWeight = 'bold'
  heading.textContent = '外觀設定'

  // Font size row
  const sizeLabel = document.createElement('div')
  sizeLabel.style.cssText = 'display:flex;flex-direction:column;gap:4px'
  const sizeTxt = document.createElement('span')
  sizeTxt.style.fontSize = '12px'; sizeTxt.textContent = '字體大小'
  const sizeRow = document.createElement('div')
  sizeRow.style.cssText = 'display:flex;align-items:center;gap:8px'
  const sizeSlider = document.createElement('input')
  sizeSlider.type = 'range'; sizeSlider.min = '11'; sizeSlider.max = '20'
  sizeSlider.value = saved.fontSize; sizeSlider.style.flex = '1'
  const sizeVal = document.createElement('span')
  sizeVal.style.cssText = 'font-size:12px;width:28px;text-align:right'
  sizeVal.textContent = saved.fontSize + 'px'
  sizeSlider.addEventListener('input', () => {
    sizeVal.textContent = sizeSlider.value + 'px'
    applySettings(current())
  })
  sizeRow.appendChild(sizeSlider); sizeRow.appendChild(sizeVal)
  sizeLabel.appendChild(sizeTxt); sizeLabel.appendChild(sizeRow)

  // Font family row
  const fontLabel = document.createElement('div')
  fontLabel.style.cssText = 'display:flex;flex-direction:column;gap:4px'
  const fontTxt = document.createElement('span')
  fontTxt.style.fontSize = '12px'; fontTxt.textContent = '字型'
  const fontSelect = document.createElement('select')
  ;[['Microsoft JhengHei','微軟正黑體'],['PMingLiU','新細明體'],['DFKai-SB','標楷體'],['Microsoft YaHei','微軟雅黑'],['Arial','Arial']].forEach(([val, lbl]) => {
    const o = document.createElement('option')
    o.value = val; o.textContent = lbl
    if (saved.fontFamily === val) o.selected = true
    fontSelect.appendChild(o)
  })
  fontSelect.addEventListener('change', () => applySettings(current()))
  fontLabel.appendChild(fontTxt); fontLabel.appendChild(fontSelect)

  // Theme row
  const themeLabel = document.createElement('div')
  themeLabel.style.cssText = 'display:flex;flex-direction:column;gap:4px'
  const themeTxt = document.createElement('span')
  themeTxt.style.fontSize = '12px'; themeTxt.textContent = '色系風格'
  const themeSelect = document.createElement('select')
  ;[['default','預設'],['dark','深夜'],['mint','薄荷'],['rose','玫瑰']].forEach(([val, lbl]) => {
    const o = document.createElement('option')
    o.value = val; o.textContent = lbl
    if (saved.theme === val) o.selected = true
    themeSelect.appendChild(o)
  })
  themeSelect.addEventListener('change', () => applySettings(current()))
  themeLabel.appendChild(themeTxt); themeLabel.appendChild(themeSelect)

  // Time format pills
  const timeLabel = document.createElement('div')
  timeLabel.style.cssText = 'display:flex;flex-direction:column;gap:4px'
  const timeTxt = document.createElement('span')
  timeTxt.style.fontSize = '12px'; timeTxt.textContent = '時間格式'
  const pillRow = document.createElement('div')
  pillRow.style.cssText = 'display:flex;gap:6px'
  let selectedFormat = saved.timeFormat || '24'
  const btn24 = document.createElement('button')
  btn24.type = 'button'; btn24.className = 'tag-btn' + (selectedFormat === '24' ? ' active' : ''); btn24.textContent = '24小時'
  const btn12 = document.createElement('button')
  btn12.type = 'button'; btn12.className = 'tag-btn' + (selectedFormat === '12' ? ' active' : ''); btn12.textContent = '12小時'
  btn24.addEventListener('click', () => { selectedFormat = '24'; btn24.classList.add('active'); btn12.classList.remove('active'); applySettings(current()) })
  btn12.addEventListener('click', () => { selectedFormat = '12'; btn12.classList.add('active'); btn24.classList.remove('active'); applySettings(current()) })
  pillRow.appendChild(btn24); pillRow.appendChild(btn12)
  timeLabel.appendChild(timeTxt); timeLabel.appendChild(pillRow)

  // Pet opacity slider
  const opacityLabel = document.createElement('div')
  opacityLabel.style.cssText = 'display:flex;flex-direction:column;gap:4px'
  const opacityTxt = document.createElement('span')
  opacityTxt.style.fontSize = '12px'; opacityTxt.textContent = '搭子透明度'
  const opacityWrap = document.createElement('div')
  opacityWrap.style.cssText = 'display:flex;align-items:center;gap:8px'
  const opacitySlider = document.createElement('input')
  opacitySlider.type = 'range'; opacitySlider.min = '0.1'; opacitySlider.max = '1'; opacitySlider.step = '0.05'
  opacitySlider.value = saved.petOpacity ?? 1; opacitySlider.style.flex = '1'
  const opacityVal = document.createElement('span')
  opacityVal.style.cssText = 'font-size:12px;width:36px;text-align:right'
  opacityVal.textContent = Math.round((saved.petOpacity ?? 1) * 100) + '%'
  opacitySlider.addEventListener('input', () => { opacityVal.textContent = Math.round(opacitySlider.value * 100) + '%'; applySettings(current()) })
  opacityWrap.appendChild(opacitySlider); opacityWrap.appendChild(opacityVal)
  opacityLabel.appendChild(opacityTxt); opacityLabel.appendChild(opacityWrap)

  // Panel size row
  const sizeWLabel = document.createElement('div')
  sizeWLabel.style.cssText = 'display:flex;flex-direction:column;gap:4px'
  const sizeTxt2 = document.createElement('span')
  sizeTxt2.style.fontSize = '12px'; sizeTxt2.textContent = '面板尺寸'
  const sizeInputRow = document.createElement('div')
  sizeInputRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px'
  const wInput = document.createElement('input')
  wInput.type = 'number'; wInput.min = '200'; wInput.max = '800'
  wInput.value = saved.panelSize?.width ?? PANEL_W
  wInput.style.cssText = 'width:60px;padding:2px 4px;border:1px solid #ddd;border-radius:4px;font-size:12px'
  const hInput = document.createElement('input')
  hInput.type = 'number'; hInput.min = '160'; hInput.max = '800'
  hInput.value = saved.panelSize?.height ?? PANEL_H
  hInput.style.cssText = 'width:60px;padding:2px 4px;border:1px solid #ddd;border-radius:4px;font-size:12px'
  sizeInputRow.appendChild(document.createTextNode('寬'))
  sizeInputRow.appendChild(wInput)
  sizeInputRow.appendChild(document.createTextNode('高'))
  sizeInputRow.appendChild(hInput)
  sizeWLabel.appendChild(sizeTxt2); sizeWLabel.appendChild(sizeInputRow)

  // Manage tags link
  const tagsBtn = document.createElement('button')
  tagsBtn.textContent = '管理標籤'
  tagsBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;color:#888;text-decoration:underline;text-align:left;padding:0'
  tagsBtn.addEventListener('click', () => { backdrop.remove(); openTagManager() })

  // Buttons
  const actions = document.createElement('div')
  actions.className = 'modal-actions'
  const cancelBtn = document.createElement('button')
  cancelBtn.textContent = '取消'; cancelBtn.className = 'modal-btn-cancel'
  cancelBtn.style.border = 'none'
  cancelBtn.addEventListener('click', () => { applySettings(saved); backdrop.remove() })
  const doneBtn = document.createElement('button')
  doneBtn.textContent = '套用'; doneBtn.className = 'modal-btn-primary'
  doneBtn.style.border = 'none'
  doneBtn.addEventListener('click', async () => {
    state.settings = current()
    const panel = document.getElementById('panel')
    panel.style.width  = state.settings.panelSize.width  + 'px'
    panel.style.height = state.settings.panelSize.height + 'px'
    backdrop.remove()
    const result = await window.notepet.save(state)
    if (result && result.error) showError('儲存失敗：' + result.error)
  })
  actions.appendChild(cancelBtn); actions.appendChild(doneBtn)

  box.appendChild(heading)
  box.appendChild(sizeLabel)
  box.appendChild(fontLabel)
  box.appendChild(themeLabel)
  box.appendChild(timeLabel)
  box.appendChild(opacityLabel)
  box.appendChild(sizeWLabel)
  box.appendChild(tagsBtn)
  box.appendChild(actions)
  backdrop.appendChild(box)
  document.body.appendChild(backdrop)

  function current() {
    return {
      fontSize:   parseInt(sizeSlider.value),
      fontFamily: fontSelect.value,
      theme:      themeSelect.value,
      timeFormat: selectedFormat,
      petOpacity: parseFloat(opacitySlider.value),
      panelSize:  { width: Math.max(200, parseInt(wInput.value) || PANEL_W), height: Math.max(160, parseInt(hInput.value) || PANEL_H) },
    }
  }
}

init()
