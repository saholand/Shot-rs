// Remove ELECTRON_RUN_AS_NODE which VSCode sets in its terminal.
// This variable makes Electron run as plain Node.js, breaking the app.
delete process.env.ELECTRON_RUN_AS_NODE

const { execSync } = require('child_process')

try {
  execSync('electron-vite dev', {
    stdio: 'inherit',
    env: process.env
  })
} catch {
  process.exit(1)
}
