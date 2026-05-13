function getDueReminders(notes) {
  const now = new Date()
  return notes.filter(note => {
    const r = note.reminder
    return r && r.enabled && !r.notified && new Date(r.datetime) <= now
  })
}

function startPolling(getState, onDue, intervalMs = 60000) {
  const tick = () => {
    const state = getState()
    const due = getDueReminders(state.notes)
    if (due.length > 0) onDue(due)
  }
  tick() // startup backfill — runs immediately before first interval
  return setInterval(tick, intervalMs)
}

module.exports = { getDueReminders, startPolling }
