import { createRoot } from 'react-dom/client'
import { WebcamApp } from './WebcamApp'
import './webcam.css'

const container = document.getElementById('webcam-root')!
createRoot(container).render(<WebcamApp />)
