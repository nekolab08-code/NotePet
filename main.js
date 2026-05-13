const { app, BrowserWindow, ipcMain, dialog, Notification, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const { randomUUID } = require('crypto')
const { loadNotes, clampPosition } = require('./src/data')
const { createWriteQueue } = require('./src/writeQueue')
const { startPolling } = require('./src/reminderService')

const DATA_PATH = path.join(__dirname, 'data', 'notes.json')
const ASSETS_USER = path.join(__dirname, 'assets', 'user')

let win
let notesState
let writeQueue

app.setAppUserModelId('com.notepet.app')

app.whenReady().then(() => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  try {
    notesState = loadNotes()
  } catch (err) {
    dialog.showErrorBox('NotePet 資料錯誤', err.message)
    app.quit()
    return
  }

  // Clamp saved position if it has moved outside current screen bounds
  if (notesState.petPosition.x !== null) {
    notesState.petPosition = clampPosition(notesState.petPosition, width, height)
  }

  fs.mkdirSync(ASSETS_USER, { recursive: true })
  writeQueue = createWriteQueue(DATA_PATH)

  win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  win.loadFile('renderer/index.html')
  win.setIgnoreMouseEvents(true, { forward: true })

  startPolling(
    () => notesState,
    (dueNotes) => {
      dueNotes.forEach(note => {
        try {
          new Notification({ title: note.title, body: note.content || '提醒時間到！' }).show()
        } catch {
          dialog.showMessageBox(win, { message: note.title, detail: note.content || '提醒時間到！' })
        }
        note.reminder.notified = true
      })
      writeQueue.enqueue(notesState)
    }
  )

  setupIPC()
})

function setupIPC() {
  ipcMain.handle('notes:load', () => {
    try { return notesState } catch (err) { return { error: err.message } }
  })

  ipcMain.handle('notes:save', (_, data) => {
    try {
      notesState = data
      return writeQueue.enqueue(notesState).then(() => ({ ok: true }))
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('pet:move', (_, pos) => {
    try {
      notesState.petPosition = pos
      writeQueue.enqueue(notesState)
    } catch { /* silent fail — position is non-critical */ }
  })

  ipcMain.handle('panel:toggle', (_, isOpen) => {
    try { win.setIgnoreMouseEvents(!isOpen, { forward: true }) } catch { /* ignore */ }
  })

  ipcMain.handle('pet:change-image', async () => {
    try {
      const result = await dialog.showOpenDialog(win, {
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
        properties: ['openFile'],
      })
      if (result.canceled) return { canceled: true }
      const src = result.filePaths[0]
      const destName = `${randomUUID()}-${path.basename(src)}`
      fs.copyFileSync(src, path.join(ASSETS_USER, destName))
      const relativePath = `assets/user/${destName}`
      notesState.petImage = relativePath
      writeQueue.enqueue(notesState)
      return { path: relativePath }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('app:quit', () => app.quit())
}

// Drain write queue before allowing the process to exit
app.on('before-quit', e => {
  if (writeQueue) {
    e.preventDefault()
    writeQueue.drain().finally(() => app.exit())
  }
})

app.on('window-all-closed', () => app.quit())
