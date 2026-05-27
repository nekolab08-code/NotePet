const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('notepet', {
  load:        ()      => ipcRenderer.invoke('notes:load'),
  save:        (data)  => ipcRenderer.invoke('notes:save', data),
  movePet:     (pos)   => ipcRenderer.invoke('pet:move', pos),
  togglePanel: (open)  => ipcRenderer.invoke('panel:toggle', open),
  changeImage: ()      => ipcRenderer.invoke('pet:change-image'),
  quit:        ()      => ipcRenderer.invoke('app:quit'),
  setIgnoreMouse:  (v) => ipcRenderer.invoke('win:set-ignore-mouse', v),
  resolveImage:    (p) => ipcRenderer.invoke('pet:resolve-image', p),
  newId:       ()      => crypto.randomUUID(),
  onReminderDue: (cb) => ipcRenderer.on('reminder:due', (_, data) => cb(data)),
})
