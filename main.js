const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const { randomUUID } = require('crypto')
const { loadNotes, clampPosition } = require('./src/data')
const { createWriteQueue } = require('./src/writeQueue')
const { startPolling } = require('./src/reminderService')

const DATA_PATH   = app.isPackaged
  ? path.join(app.getPath('userData'), 'notes.json')
  : path.join(__dirname, 'data', 'notes.json')
const ASSETS_USER = app.isPackaged
  ? path.join(app.getPath('userData'), 'user-images')
  : path.join(__dirname, 'assets', 'user')

let win
let notesState
let writeQueue

app.setAppUserModelId('com.notepet.app')

app.whenReady().then(() => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  try {
    notesState = loadNotes(DATA_PATH)
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
        if (note.reminder.interval > 0) {
          note.reminder.datetime = new Date(Date.now() + note.reminder.interval * 60000).toISOString()
        } else {
          note.reminder.notified = true
        }
        win.webContents.send('reminder:due', { id: note.id, reminder: { ...note.reminder } })
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

  ipcMain.handle('win:set-ignore-mouse', (_, ignore) => {
    try { win.setIgnoreMouseEvents(ignore, { forward: true }) } catch { /* ignore */ }
  })

  ipcMain.handle('pet:resolve-image', (_, imgPath) => {
    if (!imgPath || imgPath === 'assets/default-pet.png') return null
    const absPath = path.join(ASSETS_USER, path.basename(imgPath))
    return 'file:///' + absPath.replace(/\\/g, '/')
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
