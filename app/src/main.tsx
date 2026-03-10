import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-center" toastOptions={{ duration: 4000, style: { fontSize: '1.1rem', padding: '16px 24px' } }} />
  </React.StrictMode>
)
