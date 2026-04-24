#!/usr/bin/env node
// Claude Code sets ELECTRON_RUN_AS_NODE=1, which prevents Electron's browser
// layer from initializing (app, BrowserWindow, etc. are all undefined).
// This launcher strips that variable before spawning the Electron binary.

const { spawn } = require('child_process');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

if (process.platform === 'linux') {
  env.ELECTRON_DISABLE_SANDBOX = '1';
  env.CHROME_DEVEL_SANDBOX = '';
}

const args = process.platform === 'linux'
  ? ['.', '--no-sandbox', '--disable-setuid-sandbox']
  : ['.'];

const child = spawn(electron, args, {
  stdio: 'inherit',
  env,
  cwd: __dirname,
});

child.on('close', (code) => process.exit(code ?? 0));
