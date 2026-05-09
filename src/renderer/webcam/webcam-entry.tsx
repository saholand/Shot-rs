import { createRoot } from 'react-dom/client'
import { WebcamApp } from './WebcamApp'
import { installRendererErrorHandlers } from '../utils/install-error-handlers'
import './webcam.css'

installRendererErrorHandlers('webcam')

const container = document.getElementById('webcam-root')!
createRoot(container).render(<WebcamApp />)
