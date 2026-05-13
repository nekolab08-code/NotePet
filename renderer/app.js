const PANEL_W = 280
const PANEL_H = 360
const PANEL_THRESHOLD_H = 300  // horizontal space needed to open left/right
const PANEL_THRESHOLD_V = 380  // vertical space needed to open up

let state = null
let panelOpen = false
let activeTagFilter = null
let editingNoteId = null

async function init() {
  state = await window.notepet.load()
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
  document.getElementById('pet-img').src = '../' + state.petImage

  setupDrag(pet)
  setupPetClick(pet)
  document.getElementById('overlay').addEventListener('click', closePanel)
  window.addEventListener('blur', closePanel)
  document.getElementById('btn-add').addEventListener('click', addNote)
  document.getElementById('btn-manage-tags').addEventListener('click', openTagManager)
  renderTagFilter()
  renderNoteList()
}

function setupDrag(pet) {
  let dragging = false, ox = 0, oy = 0

  pet.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    dragging = true
    ox = e.clientX - pet.offsetLeft
    oy = e.clientY - pet.offsetTop
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
  pet.addEventListener('click', () => panelOpen ? closePanel() : openPanel())
  pet.addEventListener('contextmenu', e => { e.preventDefault(); showPetContextMenu(e) })
}

function openPanel() {
  panelOpen = true
  window.notepet.togglePanel(true)
  positionPanel()  // Direction locked at open time; not re-evaluated while panel is open
  document.getElementById('panel').classList.remove('hidden')
  document.getElementById('overlay').classList.remove('hidden')
}

function closePanel() {
  if (!panelOpen) return
  panelOpen = false
  window.notepet.togglePanel(false)
  document.getElementById('panel').classList.add('hidden')
  document.getElementById('overlay').classList.add('hidden')
  editingNoteId = null
  renderNoteList()
}

function positionPanel() {
  const pet = document.getElementById('pet-container')
  const panel = document.getElementById('panel')
  const px = parseInt(pet.style.left)
  const py = parseInt(pet.style.top)
  const vw = window.innerWidth
  const vh = window.innerHeight
  let x, y

  if (px >= PANEL_THRESHOLD_H) {               // enough room on the left
    x = px - PANEL_W - 4; y = py
  } else if (vw - px - 80 >= PANEL_THRESHOLD_H) { // enough room on the right
    x = px + 84; y = py
  } else if (py >= PANEL_THRESHOLD_V) {          // enough room above
    x = px; y = py - PANEL_H - 4
  } else {                                       // bottom-right fallback
    x = Math.min(px + 84, vw - PANEL_W)
    y = Math.min(py + 84, vh - PANEL_H)
  }

  panel.style.left = Math.max(0, x) + 'px'
  panel.style.top  = Math.max(0, y) + 'px'
}

async function showPetContextMenu(e) {
  const items = ['更換搭子圖片', '關閉 NotePet']
  const action = await showContextMenu(items, e.clientX, e.clientY)
  if (action === '更換搭子圖片') {
    const result = await window.notepet.changeImage()
    if (result && result.path) {
      state.petImage = result.path
      document.getElementById('pet-img').src = '../' + result.path
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

init()
