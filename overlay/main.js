const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');

// API base URL - configurable for dev vs production
const API_BASE = process.env.DRAFTSENSE_API || 'http://localhost:5000/api';

let overlayWindow = null;
let settingsWindow = null;
let isOverlayVisible = false;

// League client integration polling interval
let pollInterval = null;
const POLL_MS = 5000;

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 350,
    height: 600,
    x: width - 370,
    y: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile('overlay.html');
  overlayWindow.setIgnoreMouseEvents(false);

  // Allow click-through when not hovering
  overlayWindow.on('blur', () => {
    if (isOverlayVisible) {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  });

  overlayWindow.on('focus', () => {
    overlayWindow.setIgnoreMouseEvents(false);
  });
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 500,
    height: 400,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadFile('settings.html');
}

// Fetch data from DraftSense API
async function fetchApi(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const client = url.startsWith('https') ? https : http;

    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON')); }
      });
    }).on('error', reject);
  });
}

// Poll for active game via the League Client API (LCU)
async function checkForActiveGame(gameName, tagLine, region) {
  try {
    const game = await fetchApi(`/game/active?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}&region=${encodeURIComponent(region)}`);
    return game;
  } catch {
    return null;
  }
}

// Get build recommendation
async function getRecommendation(championId, enemyIds, allyIds, role) {
  try {
    const params = new URLSearchParams({
      championId: championId.toString(),
      enemyChampions: enemyIds.join(','),
      allyChampions: allyIds.join(','),
    });
    if (role) params.set('role', role);

    return await fetchApi(`/build/recommend?${params}`);
  } catch {
    return null;
  }
}

// Get mid-game advice
async function getMidGameAdvice(championId, enemyIds, currentItems, gold, role, gameState) {
  try {
    const params = new URLSearchParams({
      championId: championId.toString(),
      enemyChampions: enemyIds.join(','),
      gold: gold.toString(),
    });
    if (currentItems.length) params.set('currentItems', currentItems.join(','));
    if (role) params.set('role', role);
    if (gameState) params.set('gameState', gameState);

    return await fetchApi(`/build/midgame?${params}`);
  } catch {
    return null;
  }
}

// IPC handlers
ipcMain.handle('get-active-game', async (_, gameName, tagLine, region) => {
  return await checkForActiveGame(gameName, tagLine, region);
});

ipcMain.handle('get-recommendation', async (_, championId, enemyIds, allyIds, role) => {
  return await getRecommendation(championId, enemyIds, allyIds, role);
});

ipcMain.handle('get-midgame-advice', async (_, championId, enemyIds, currentItems, gold, role, gameState) => {
  return await getMidGameAdvice(championId, enemyIds, currentItems, gold, role, gameState);
});

ipcMain.handle('toggle-overlay', () => {
  isOverlayVisible = !isOverlayVisible;
  if (overlayWindow) {
    if (isOverlayVisible) overlayWindow.show();
    else overlayWindow.hide();
  }
  return isOverlayVisible;
});

ipcMain.handle('start-polling', (_, gameName, tagLine, region) => {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    const game = await checkForActiveGame(gameName, tagLine, region);
    if (game && overlayWindow) {
      overlayWindow.webContents.send('game-detected', game);
    }
  }, POLL_MS);
});

ipcMain.handle('stop-polling', () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
});

app.whenReady().then(() => {
  createOverlayWindow();
  overlayWindow.hide(); // Start hidden, show when game detected

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createOverlayWindow();
  });
});

app.on('window-all-closed', () => {
  if (pollInterval) clearInterval(pollInterval);
  if (process.platform !== 'darwin') app.quit();
});
