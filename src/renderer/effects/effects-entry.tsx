import { createRoot } from 'react-dom/client'
import { EffectsApp } from './EffectsApp'
import './effects.css'

const container = document.getElementById('effects-root')!
createRoot(container).render(<EffectsApp />)
