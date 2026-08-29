import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/hirefit-design-system.css'
import './index.css'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import HireFitLayout, {
  LandingPage,
  AnalyzePage,
  AnalyzerPage,
  AccountSettingsPage,
  DashboardPage,
  LoginPage,
  RoadmapRoute,
  TermsPage,
  PrivacyPage,
  CookiePolicyPage,
} from './App.jsx'
import CareerOnboardingPage from './CareerOnboardingPage.jsx'
import VerifyEmailPage from './VerifyEmailPage.jsx'
import ReportPage from './ReportPage.jsx'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HireFitLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="analyze" element={<AnalyzePage />} />
            <Route path="app" element={<AnalyzerPage />} />
            <Route path="settings" element={<AccountSettingsPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="onboarding" element={<CareerOnboardingPage />} />
            <Route path="career-dna" element={<CareerOnboardingPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="roadmap" element={<RoadmapRoute />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="cookie-policy" element={<CookiePolicyPage />} />
          </Route>
          <Route path="/report/:id" element={<ReportPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

