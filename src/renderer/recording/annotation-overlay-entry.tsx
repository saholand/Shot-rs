import React from 'react'
import ReactDOM from 'react-dom/client'
import { LiveAnnotationOverlay } from './LiveAnnotationOverlay'

ReactDOM.createRoot(document.getElementById('annotation-root')!).render(
  <React.StrictMode>
    <LiveAnnotationOverlay />
  </React.StrictMode>
)
