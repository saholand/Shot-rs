import { createRoot } from 'react-dom/client'
import { HighlighterCursorApp } from './HighlighterCursorApp'
import './highlighter-cursor.css'

const container = document.getElementById('highlighter-root')!
createRoot(container).render(<HighlighterCursorApp />)
