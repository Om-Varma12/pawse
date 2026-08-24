import { app, shell, BrowserWindow, ipcMain, Menu, Tray } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import { createCatWindow } from './catWindow';
import { startDetectorLoop, stopDetectorLoop } from './detector';
import { getRules, saveRules } from './detector/ruleEngine';

let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createSettingsWindow(): void {
  settingsWindow = new BrowserWindow({
    width: 650,
    height: 700,
    show: false,
    title: 'Pawse - Settings',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  });

  settingsWindow.on('ready-to-show', () => {
    settingsWindow?.show();
  });

  // Prevent app termination on settings window close; just hide to tray
  settingsWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      settingsWindow?.hide();
    }
  });

  settingsWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Use URL hash to route to the settings screen in React
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#settings');
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'settings' });
  }
}

function createTray(): void {
  const iconPath = join(app.getAppPath(), 'resources', 'icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Settings',
      click: (): void => {
        if (!settingsWindow) {
          createSettingsWindow();
        } else {
          settingsWindow.show();
        }
      }
    },
    {
      label: 'Pet Cat ❤️',
      click: (): void => {
        // Broadcast pet event internally
        ipcMain.emit('cat:pet');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: (): void => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Pawse - Windows Focus Cat');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (!settingsWindow) {
      createSettingsWindow();
    } else {
      settingsWindow.show();
    }
  });
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pawse.app');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Setup settings and rule management IPC channels
  ipcMain.handle('rules:get', () => {
    return getRules();
  });

  ipcMain.handle('rules:save', (_event, rules) => {
    saveRules(rules);
    return true;
  });

  ipcMain.handle('settings:get-autostart', () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('settings:set-autostart', (_event, enable: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: app.getPath('exe')
    });
    return true;
  });

  // Create the settings window and the transparent cat overlay
  createSettingsWindow();
  createCatWindow();
  createTray();

  // Kickoff the window tracking loop
  startDetectorLoop();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSettingsWindow();
      createCatWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  stopDetectorLoop();
});
