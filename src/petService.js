const DECAY_AMOUNT = 3
const DECAY_INTERVAL_MS = 15 * 60 * 1000
const INTERACT_COOLDOWN_MS = 3 * 60 * 1000

let _notesState = null
let _writeQueue = null
let _win = null
let _decayTimer = null

function getStage(mood) {
  if (mood >= 70) return 'happy'
  if (mood >= 30) return 'normal'
  return 'sad'
}

function clamp(val) {
  return Math.max(0, Math.min(100, val))
}

function pushUpdate() {
  if (_win && !_win.isDestroyed()) {
    _win.webContents.send('pet:mood-updated', getMood())
  }
}

function start(notesState, writeQueue, win) {
  _notesState = notesState
  _writeQueue = writeQueue
  _win = win
  _decayTimer = setInterval(() => {
    _notesState.pet.mood = clamp(_notesState.pet.mood - DECAY_AMOUNT)
    _writeQueue.enqueue(_notesState)
    pushUpdate()
  }, DECAY_INTERVAL_MS)
}

function boostMood(amount) {
  if (!_notesState) return
  _notesState.pet.mood = clamp(_notesState.pet.mood + amount)
  _writeQueue.enqueue(_notesState)
  pushUpdate()
}

function interact(type) {
  if (!_notesState) return { cooldownActive: true }
  const now = Date.now()
  const last = _notesState.pet.lastInteractAt ? new Date(_notesState.pet.lastInteractAt).getTime() : 0
  if (now - last < INTERACT_COOLDOWN_MS) {
    return { ...getMood(), cooldownActive: true }
  }
  _notesState.pet.lastInteractAt = new Date().toISOString()
  const amount = type === 'play' ? 8 : 5
  _notesState.pet.mood = clamp(_notesState.pet.mood + amount)
  _writeQueue.enqueue(_notesState)
  pushUpdate()
  return { ...getMood(), cooldownActive: false }
}

function getMood() {
  const mood = _notesState?.pet?.mood ?? 80
  return { mood, stage: getStage(mood) }
}

module.exports = { start, boostMood, interact, getMood }
