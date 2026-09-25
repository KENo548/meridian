import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSentry } from './lib/sentry.ts'

// Privacy-safe error monitoring. DSN-gated and fail-open: a missing DSN
// or a Sentry failure never affects startup or rendering.
void initSentry().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
