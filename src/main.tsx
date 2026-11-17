import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../@/styles/_variables.scss'
import '../@/styles/_keyframe-animations.scss'
import './index.css'
import App from './App.tsx'
import { initialiseDataMode } from './data/initialise'

initialiseDataMode()

// The UI kit uses a class for dark mode; keep portalled menus in the same theme.
const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
const syncColorScheme = () => document.documentElement.classList.toggle('dark', colorScheme.matches)
syncColorScheme()
colorScheme.addEventListener('change', syncColorScheme)
if (import.meta.hot) {
  import.meta.hot.dispose(() => colorScheme.removeEventListener('change', syncColorScheme))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
