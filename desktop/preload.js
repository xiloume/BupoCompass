const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setInteractive: (interactive) => ipcRenderer.send('set-interactive', interactive),
  setAlwaysOnTop: (onTop) => ipcRenderer.send('set-always-on-top', onTop),
  setFocusable: (focusable) => ipcRenderer.send('set-focusable', focusable),
  setCompact: (compact) => ipcRenderer.send('set-compact', compact),
  resizeWindow: (size) => ipcRenderer.send('resize-window', size),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  onInteractiveChanged: (callback) => {
    ipcRenderer.on('interactive-changed', (_event, interactive) => callback(interactive));
  },

  // Game detection
  detectGameNow: () => ipcRenderer.invoke('game:detect-now'),
  getGameRegistry: () => ipcRenderer.invoke('game:registry'),
  scanGame: (gameId) => ipcRenderer.invoke('game:scan', gameId),
  scanDirectory: (root, opts) => ipcRenderer.invoke('game:scan-directory', root, opts),
  listProcesses: () => ipcRenderer.invoke('game:list-processes'),
  onGameDetected: (callback) => {
    const handler = (_event, game) => callback(game);
    ipcRenderer.on('game-detected', handler);
    return () => ipcRenderer.removeListener('game-detected', handler);
  },

  // Auto-sync watcher
  startGameWatch: (gameId) => ipcRenderer.invoke('game:watch-start', gameId),
  stopGameWatch: (gameId) => ipcRenderer.invoke('game:watch-stop', gameId),
  getSteamPath: () => ipcRenderer.invoke('steam:get-path'),
  scanSteamAchievements: (gameId) => ipcRenderer.invoke('steam:scan-achievements', gameId),
  getSteamConfigStatus: () => ipcRenderer.invoke('steam:get-config-status'),
  setSteamConfig: (config) => ipcRenderer.invoke('steam:set-config', config),
  getSteamGameSchema: (gameId) => ipcRenderer.invoke('steam:get-game-schema', gameId),

  // Template generator
  searchSteamGames: (query) => ipcRenderer.invoke('templates:search-steam', query),
  generateTemplate: (appId, opts) => ipcRenderer.invoke('templates:generate', appId, opts),
  saveTemplate: (entry) => ipcRenderer.invoke('templates:save', entry),
  listLocalTemplates: () => ipcRenderer.invoke('templates:list-local'),
  deleteTemplate: (id) => ipcRenderer.invoke('templates:delete', id),

  // Community templates
  browseCommunityTemplates: (query) => ipcRenderer.invoke('templates:community-browse', query),
  publishTemplate: (id) => ipcRenderer.invoke('templates:publish', id),
  voteTemplate: (id, vote) => ipcRenderer.invoke('templates:vote', id, vote),

  onSaveChanged: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('game-save-changed', handler);
    return () => ipcRenderer.removeListener('game-save-changed', handler);
  },
});
