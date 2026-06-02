function getDueReminders(notes) {
  const now = new Date()
  return notes.filter(note => {
    const r = note.reminder
    if (!r || !r.enabled || r.notified) return false
    const triggerTime = new Date(new Date(r.datetime) - (r.advanceMinutes ?? 0) * 60000)
    return triggerTime <= now
  })
}

// startup backfill — tick() runs immediately before first interval
function startPolling(getState, onDue, petService, intervalMs = 60000) {
  const tick = () => {
    const state = getState()
    const due = getDueReminders(state.notes)
    if (due.length > 0) onDue(due, petService)
  }
  tick()
  return setInterval(tick, intervalMs)
}

module.exports = { getDueReminders, startPolling }
