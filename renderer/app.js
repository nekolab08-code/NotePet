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

init()
