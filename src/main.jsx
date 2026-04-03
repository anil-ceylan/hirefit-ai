import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MainApp from './App.jsx'
import ReportPage from './ReportPage.jsx'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/app" element={<MainApp />} />
        <Route path="/dashboard" element={<MainApp />} />
        <Route path="/login" element={<MainApp />} />
        <Route path="/report/:id" element={<ReportPage />} />
        <Route path="/terms" element={<MainApp />} />
        <Route path="/privacy" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)