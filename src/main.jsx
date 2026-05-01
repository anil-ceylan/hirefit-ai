import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import HireFitLayout, {
  LandingPage,
  AnalyzerPage,
  DashboardPage,
  LoginPage,
  RoadmapRoute,
  TermsPage,
  PrivacyPage,
} from './App.jsx'
import ReportPage from './ReportPage.jsx'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HireFitLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="app" element={<AnalyzerPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="roadmap" element={<RoadmapRoute />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
          </Route>
          <Route path="/report/:id" element={<ReportPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
