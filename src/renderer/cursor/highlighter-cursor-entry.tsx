import { createRoot } from 'react-dom/client'
import { HighlighterCursorApp } from './HighlighterCursorApp'
import { installRendererErrorHandlers } from '../utils/install-error-handlers'
import './highlighter-cursor.css'

installRendererErrorHandlers('highlighter-cursor')

const container = document.getElementById('highlighter-root')!
createRoot(container).render(<HighlighterCursorApp />)
