import React from 'react'
import ReactDOM from 'react-dom/client'
import { LiveAnnotationOverlay } from './LiveAnnotationOverlay'
import { setLanguage } from '../../shared/i18n'
import { installRendererErrorHandlers } from '../utils/install-error-handlers'

installRendererErrorHandlers('annotation-overlay')

// Annotation overlay is its own renderer process — pull the current
// language from settings before first render so OCR toast strings
// match the user's chosen language.
const root = ReactDOM.createRoot(document.getElementById('annotation-root')!)
const render = () => root.render(
  <React.StrictMode>
    <LiveAnnotationOverlay />
  </React.StrictMode>
)
window.electronAPI.settings.get()
  .then(s => { if (s.language) setLanguage(s.language) })
  .catch(() => { /* keep default */ })
  .finally(render)
