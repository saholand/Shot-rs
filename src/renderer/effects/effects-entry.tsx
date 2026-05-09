import { createRoot } from 'react-dom/client'
import { EffectsApp } from './EffectsApp'
import { installRendererErrorHandlers } from '../utils/install-error-handlers'
import './effects.css'

installRendererErrorHandlers('effects')

const container = document.getElementById('effects-root')!
createRoot(container).render(<EffectsApp />)
