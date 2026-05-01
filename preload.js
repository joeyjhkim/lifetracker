/**
 * preload.js
 *
 * Runs in a sandboxed context between Electron's main process and the React
 * renderer. Exposes a safe, limited API (window.electronAPI) so the React app
 * can read/write data without having direct Node.js access.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readData:    ()     => ipcRenderer.invoke('data:read'),
  writeData:   (data) => ipcRenderer.invoke('data:write', data),
  getDataPath: ()     => ipcRenderer.invoke('data:getPath'),
  exportData:  (data) => ipcRenderer.invoke('data:export', data),
  importData:  ()     => ipcRenderer.invoke('data:import'),
  exportCSV:   (args) => ipcRenderer.invoke('data:exportCSV', args),

  // Icon preset — change tray + dock icon live without rebuild.
  setIconPreset:    (id) => ipcRenderer.invoke('app:setIconPreset', id),
  getIconPreview:   (id) => ipcRenderer.invoke('app:iconPreview', id),
  listIconPresets:  ()   => ipcRenderer.invoke('app:listIconPresets'),

  // Tray integration — renderer pushes summary stats to the tray menu
  // and listens for quick-action clicks from tray menu items.
  updateTray:   (stats) => ipcRenderer.send('tray:update', stats),
  onTrayAction: (cb)    => {
    ipcRenderer.on('tray:action', (_e, action) => cb(action));
    return () => ipcRenderer.removeAllListeners('tray:action');
  },

  // Data reload — fired when the tray popup saves directly to disk.
  // The renderer re-reads the file to stay in sync.
  onDataReload: (cb)    => {
    ipcRenderer.on('data:reload', () => cb());
    return () => ipcRenderer.removeAllListeners('data:reload');
  },

  // Navigation events from the tray popover (e.g. "View Calendar").
  onNavigate: (cb) => {
    ipcRenderer.on('tray:navigate', (_e, target) => cb(target));
    return () => ipcRenderer.removeAllListeners('tray:navigate');
  },
});
