const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.argv.includes('--dev');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        frame: false,
        backgroundColor: '#18181c',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
            webSecurity: true
        },
        icon: path.join(__dirname, 'dashboard', 'icon.png') // Optional: add icon later
    });

    // Remove default menu bar
    mainWindow.setMenu(null);

    // Auto-maximize window on startup
    mainWindow.maximize();

    // Load the dashboard
    if (isDev) {
        // In dev mode, load from local server
        mainWindow.loadURL('http://127.0.0.1:8080/index.html');
        // Open DevTools in dev mode
        mainWindow.webContents.openDevTools();
    } else {
        // In production, load from file
        mainWindow.loadFile(path.join(__dirname, 'dashboard', 'index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle window controls
    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window-maximized', true);
    });

    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window-maximized', false);
    });
}

// App lifecycle
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handlers for window controls — use the window that sent the event
ipcMain.handle('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
});

ipcMain.handle('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    }
});

ipcMain.handle('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
});

ipcMain.handle('window-is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? win.isMaximized() : false;
});

// IPC handler for opening chat window
ipcMain.handle('open-chat-window', () => {
    const chatWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        frame: false,
        backgroundColor: '#18181c',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
            webSecurity: true
        },
        parent: mainWindow,
        modal: false
    });

    chatWindow.setMenu(null);

    // Forward maximize/restore state to the chat window's renderer
    chatWindow.on('maximize', () => {
        chatWindow.webContents.send('window-maximized', true);
    });
    chatWindow.on('unmaximize', () => {
        chatWindow.webContents.send('window-maximized', false);
    });

    if (isDev) {
        chatWindow.loadURL('http://127.0.0.1:8080/chat.html');
        chatWindow.webContents.openDevTools();
    } else {
        chatWindow.loadFile(path.join(__dirname, 'dashboard', 'chat.html'));
    }

    chatWindow.on('closed', () => {
        // Clean up when chat window is closed
    });

    return true;
});
