const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('popupAPI', {
  quickSave: (data) => ipcRenderer.invoke('quick:save', data),
});
