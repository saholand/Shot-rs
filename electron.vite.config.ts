import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
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
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay.html'),
          'annotation-overlay': resolve(__dirname, 'src/renderer/annotation-overlay.html'),
          'annotation-toolbar': resolve(__dirname, 'src/renderer/annotation-toolbar.html'),
          'highlighter-cursor': resolve(__dirname, 'src/renderer/highlighter-cursor.html')
        }
      }
    }
  }
})
