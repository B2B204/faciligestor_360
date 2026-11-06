import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { installGlobalErrorHandlers } from '@/lib/errorReporter'

installGlobalErrorHandlers()

// The application only supports the light theme. Remove any preference left
// behind by older versions before React renders the interface.
document.documentElement.classList.remove('dark')
try {
  localStorage.removeItem('theme')
} catch {
  // Armazenamento bloqueado (modo privado, política do navegador): ignorar.
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
