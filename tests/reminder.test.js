const { getDueReminders, startPolling } = require('../src/reminderService')

const past   = new Date(Date.now() - 60000).toISOString()
const future = new Date(Date.now() + 60000).toISOString()

const notes = [
  { id: '1', title: 'A', content: '', reminder: { enabled: true,  datetime: past,   notified: false } },
  { id: '2', title: 'B', content: '', reminder: { enabled: true,  datetime: future, notified: false } },
  { id: '3', title: 'C', content: '', reminder: { enabled: true,  datetime: past,   notified: true  } },
  { id: '4', title: 'D', content: '', reminder: { enabled: false, datetime: past,   notified: false } },
]

test('getDueReminders returns only enabled, unnotified, past reminders', () => {
  const due = getDueReminders(notes)
  expect(due.length).toBe(1)
  expect(due[0].id).toBe('1')
})

test('getDueReminders returns empty array when nothing is due', () => {
  expect(getDueReminders([])).toEqual([])
})

test('startPolling fires onDue immediately on startup (backfill)', () => {
  const fired = []
  const state = { notes }
  const id = startPolling(() => state, (due) => fired.push(...due), 60000)
  clearInterval(id)
  expect(fired.length).toBe(1)
  expect(fired[0].id).toBe('1')
})

test('startPolling does not call onDue on startup when no reminders are due', () => {
  const fired = []
  const state = { notes: [] }
  const id = startPolling(() => state, (due) => fired.push(...due), 60000)
  clearInterval(id)
  expect(fired.length).toBe(0)
})
