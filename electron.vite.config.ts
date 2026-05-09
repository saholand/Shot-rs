import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Single source of truth for the app version. Read at build time and
// inlined as __APP_VERSION__ so the renderer can render it without
// shipping the whole package.json.
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const versionDefine = { __APP_VERSION__: JSON.stringify(pkg.version) }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: versionDefine,
    build: {
      lib: {
        entry: resolve(__dirname, 'src/main/index.ts')
      },
      minify: 'esbuild'
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/preload/index.ts')
      },
      minify: 'esbuild'
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    define: versionDefine,
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay.html'),
          'annotation-overlay': resolve(__dirname, 'src/renderer/annotation-overlay.html'),
          'annotation-toolbar': resolve(__dirname, 'src/renderer/annotation-toolbar.html'),
          'highlighter-cursor': resolve(__dirname, 'src/renderer/highlighter-cursor.html'),
          effects: resolve(__dirname, 'src/renderer/effects.html'),
          webcam: resolve(__dirname, 'src/renderer/webcam.html')
        }
      }
    }
  }
})
