const { app, BrowserWindow, ipcMain, dialog, screen, Tray, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const { randomUUID } = require('crypto')
const { loadNotes, clampPosition } = require('./src/data')
const { createWriteQueue } = require('./src/writeQueue')
const { startPolling } = require('./src/reminderService')
const petService = require('./src/petService')

const DATA_PATH   = app.isPackaged
  ? path.join(app.getPath('userData'), 'notes.json')
  : path.join(__dirname, 'data', 'notes.json')
const ASSETS_USER = app.isPackaged
  ? path.join(app.getPath('userData'), 'user-images')
  : path.join(__dirname, 'assets', 'user')

let win
let tray
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

  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: !!(notesState.settings?.autoLaunch) })
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
  petService.start(notesState, writeQueue, win)
  win.setIgnoreMouseEvents(true, { forward: true })
  createTray()

  startPolling(
    () => notesState,
    (dueNotes, ps) => {
      showMainWindow()
      dueNotes.forEach(note => {
        // +8 for FloatNote opening; +12 for marking notified=true on one-time reminders.
        // Both fire in the same tick (total +20 per completed reminder) — this is intentional.
        ps.boostMood(8)
        if (note.reminder.interval > 0) {
          note.reminder.datetime = new Date(Date.now() + note.reminder.interval * 60000).toISOString()
        } else {
          note.reminder.notified = true
          ps.boostMood(12)
        }
        win.webContents.send('reminder:due', { id: note.id, reminder: { ...note.reminder } })
      })
      writeQueue.enqueue(notesState)
    },
    petService
  )

  setupIPC()
})

function showMainWindow() {
  if (!win) return
  win.show()
  win.focus()
}

function createTray() {
  if (tray) return
  const iconPath = path.join(__dirname, 'assets', 'icon.ico')
  tray = new Tray(iconPath)
  tray.setToolTip('NotePet')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '顯示 NotePet', click: showMainWindow },
    { type: 'separator' },
    { label: '關閉 NotePet', click: () => app.quit() },
  ]))
  tray.on('click', showMainWindow)
}

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
      const imported = await importPetImage()
      if (imported.canceled || imported.error) return imported
      const relativePath = imported.path
      notesState.petImage = relativePath
      writeQueue.enqueue(notesState)
      return { path: relativePath }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('pet:import-image', () => importPetImage())

  ipcMain.handle('win:set-ignore-mouse', (_, ignore) => {
    try { win.setIgnoreMouseEvents(ignore, { forward: true }) } catch { /* ignore */ }
  })

  ipcMain.handle('pet:resolve-image', (_, imgPath) => {
    if (!imgPath || imgPath === 'assets/default-pet.png') return null
    if (imgPath.startsWith('assets/user/')) {
      const absPath = path.join(ASSETS_USER, path.basename(imgPath))
      return 'file:///' + absPath.replace(/\\/g, '/')
    }
    return null
  })

  ipcMain.handle('app:quit', () => app.quit())

  ipcMain.handle('app:hide-to-tray', () => {
    try {
      win.hide()
      return { ok: true }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('app:set-auto-launch', (_, enable) => {
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!enable })
  })

  ipcMain.handle('pet:get-mood', () => petService.getMood())

  ipcMain.handle('pet:interact', (_, type) => petService.interact(type))

  ipcMain.handle('notes:note-created', () => {
    petService.boostMood(15)
  })
}

async function importPetImage() {
  try {
    const result = await dialog.showOpenDialog(win, {
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
      properties: ['openFile'],
    })
    if (result.canceled) return { canceled: true }
    const src = result.filePaths[0]
    const destName = `${randomUUID()}-${path.basename(src)}`
    fs.copyFileSync(src, path.join(ASSETS_USER, destName))
    return { path: `assets/user/${destName}` }
  } catch (err) {
    return { error: err.message }
  }
}

// Drain write queue before allowing the process to exit
app.on('before-quit', e => {
  if (writeQueue) {
    e.preventDefault()
    writeQueue.drain().finally(() => app.exit())
  }
})

app.on('window-all-closed', () => app.quit())
