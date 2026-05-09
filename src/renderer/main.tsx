import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installRendererErrorHandlers } from './utils/install-error-handlers'
import './App.css'

installRendererErrorHandlers('main')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
