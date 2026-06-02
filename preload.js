const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('notepet', {
  load:        ()      => ipcRenderer.invoke('notes:load'),
  save:        (data)  => ipcRenderer.invoke('notes:save', data),
  movePet:     (pos)   => ipcRenderer.invoke('pet:move', pos),
  togglePanel: (open)  => ipcRenderer.invoke('panel:toggle', open),
  changeImage: ()      => ipcRenderer.invoke('pet:change-image'),
  importPetImage: ()   => ipcRenderer.invoke('pet:import-image'),
  quit:        ()      => ipcRenderer.invoke('app:quit'),
  hideToTray:  ()      => ipcRenderer.invoke('app:hide-to-tray'),
  setIgnoreMouse:  (v) => ipcRenderer.invoke('win:set-ignore-mouse', v),
  resolveImage:    (p) => ipcRenderer.invoke('pet:resolve-image', p),
  newId:       ()      => crypto.randomUUID(),
  onReminderDue:  (cb) => ipcRenderer.on('reminder:due', (_, data) => cb(data)),
  setAutoLaunch:  (val) => ipcRenderer.invoke('app:set-auto-launch', val),
  petInteract:    (type) => ipcRenderer.invoke('pet:interact', type),
  getMood:        ()     => ipcRenderer.invoke('pet:get-mood'),
  onMoodUpdated:  (cb)   => ipcRenderer.on('pet:mood-updated', (_, data) => cb(data)),
  noteCreated:    ()     => ipcRenderer.invoke('notes:note-created'),
})
