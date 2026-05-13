const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    openChatWindow: () => ipcRenderer.invoke('open-chat-window'),

    // Listen for window state changes
    onWindowMaximized: (callback) => {
        ipcRenderer.on('window-maximized', (event, isMaximized) => callback(isMaximized));
    },

    // Platform info
    platform: process.platform,
    version: process.versions.electron
});
