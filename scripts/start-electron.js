const { spawn } = require('child_process');
const path = require('path');

// Remove ELECTRON_RUN_AS_NODE to allow Electron to start properly
// (IDE terminals like VS Code/Windsurf set this, breaking Electron)
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronPath = require('electron');
const appPath = path.resolve(__dirname, '..');

const child = spawn(electronPath, [appPath], {
  env,
  stdio: 'inherit',
  windowsHide: false,
});

child.on('close', (code) => {
  process.exit(code);
});
