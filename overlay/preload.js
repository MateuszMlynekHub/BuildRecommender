const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('draftsense', {
  getActiveGame: (gameName, tagLine, region) =>
    ipcRenderer.invoke('get-active-game', gameName, tagLine, region),
  getRecommendation: (championId, enemyIds, allyIds, role) =>
    ipcRenderer.invoke('get-recommendation', championId, enemyIds, allyIds, role),
  getMidGameAdvice: (championId, enemyIds, currentItems, gold, role, gameState) =>
    ipcRenderer.invoke('get-midgame-advice', championId, enemyIds, currentItems, gold, role, gameState),
  toggleOverlay: () => ipcRenderer.invoke('toggle-overlay'),
  startPolling: (gameName, tagLine, region) =>
    ipcRenderer.invoke('start-polling', gameName, tagLine, region),
  stopPolling: () => ipcRenderer.invoke('stop-polling'),
  onGameDetected: (callback) =>
    ipcRenderer.on('game-detected', (_, game) => callback(game)),
});
