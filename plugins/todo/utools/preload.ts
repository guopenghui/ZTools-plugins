import { ipcRenderer, clipboard } from 'electron'
import { registerTools } from './mcp'

// Register AI tools
registerTools()

window.services = {
  ipc: ipcRenderer,
  clipboard
}
