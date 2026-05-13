const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('notepet', {
  load:        ()      => ipcRenderer.invoke('notes:load'),
  save:        (data)  => ipcRenderer.invoke('notes:save', data),
  movePet:     (pos)   => ipcRenderer.invoke('pet:move', pos),
  togglePanel: (open)  => ipcRenderer.invoke('panel:toggle', open),
  changeImage: ()      => ipcRenderer.invoke('pet:change-image'),
  quit:        ()      => ipcRenderer.invoke('app:quit'),
  newId:       ()      => crypto.randomUUID(),
})
