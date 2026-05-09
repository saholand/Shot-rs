import React from 'react'
import ReactDOM from 'react-dom/client'
import { OverlayApp } from './OverlayApp'
import { setLanguage } from '../../shared/i18n'
import { installRendererErrorHandlers } from '../utils/install-error-handlers'
import './overlay.css'

installRendererErrorHandlers('overlay')

// Overlay window is its own renderer process — pull the current language
// from settings before first render so hint/placeholder text matches the
// user's chosen language instead of the i18n module's 'tr' default.
const root = ReactDOM.createRoot(document.getElementById('overlay-root')!)
const render = () => root.render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
)
window.electronAPI.settings.get()
  .then(s => { if (s.language) setLanguage(s.language) })
  .catch(() => { /* keep default */ })
  .finally(render)
