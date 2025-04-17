const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  const startURL = app.isPackaged
    ? `file://${path.join(__dirname, '../web/build/index.html')}`
    : 'http://localhost:3000';

  mainWindow.loadURL(startURL);
});

