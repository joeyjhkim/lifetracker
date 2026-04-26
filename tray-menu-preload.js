const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('menuAPI', {
  ready:          ()        => ipcRenderer.send('menu:ready'),
  hide:           ()        => ipcRenderer.send('menu:hide'),
  logMood:        (score)   => ipcRenderer.send('menu:logMood', score),
  logMeal:        (meal)    => ipcRenderer.send('menu:logMeal', meal),
  openPopup:      (type)    => ipcRenderer.send('menu:openPopup', type),
  openMainWindow: ()        => ipcRenderer.send('menu:openMain'),
  navigate:       (target)  => ipcRenderer.send('menu:navigate', target),
  toggleTask:     (payload) => ipcRenderer.send('menu:toggleTask', payload),
  deleteTask:     (payload) => ipcRenderer.send('menu:deleteTask', payload),
  addTask:        (payload) => ipcRenderer.send('menu:addTask', payload),
  editTaskNotes:  (payload) => ipcRenderer.send('menu:editTaskNotes', payload),
  quitApp:        ()        => ipcRenderer.send('menu:quit'),
  onStats:        (cb)      => ipcRenderer.on('menu:stats', (_e, s) => cb(s)),
});
