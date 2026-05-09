import React from 'react'
import ReactDOM from 'react-dom/client'
import { AnnotationToolbarApp } from './AnnotationToolbarApp'
import { setLanguage } from '../../shared/i18n'
import { installRendererErrorHandlers } from '../utils/install-error-handlers'

installRendererErrorHandlers('annotation-toolbar')

// Toolbar window is its own renderer process, so the main window's
// setLanguage doesn't reach it. Pull the current language from settings
// before the first render so labels start in the user's language.
const root = ReactDOM.createRoot(document.getElementById('toolbar-root')!)
const render = () => root.render(
  <React.StrictMode>
    <AnnotationToolbarApp />
  </React.StrictMode>
)
window.electronAPI.settings.get()
  .then(s => { if (s.language) setLanguage(s.language) })
  .catch(() => { /* keep default */ })
  .finally(render)
