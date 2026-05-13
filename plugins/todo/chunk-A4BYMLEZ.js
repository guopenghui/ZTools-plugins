"use strict";

var _chunkRWQ772WPjs = require('./chunk-RWQ772WP.js');

// public/utools/preload.ts
var _electron = require('electron');
_chunkRWQ772WPjs.registerTools.call(void 0, );
window.services = {
  ipc: _electron.ipcRenderer,
  clipboard: _electron.clipboard
};
