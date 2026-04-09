import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Navbar } from './components/layout/Navbar'
import { OverviewPage } from './pages/Overview'
import { OrchestratorPage } from './pages/Orchestrator'
import { RevenuePage } from './pages/agents/RevenuePage'
import { GuestPage } from './pages/agents/GuestPage'
import { OperationsPage } from './pages/agents/OperationsPage'
import { AnalyticsPage } from './pages/agents/AnalyticsPage'
import { MarketingPage } from './pages/agents/MarketingPage'
import { InputsPage } from './pages/Inputs'
import { SettingsPage } from './pages/Settings'
import { IntegrationsPage } from './pages/Integrations'
import { EmailTriagePage } from './pages/EmailTriage'
import { LoginPage } from './pages/auth/LoginPage'
import LoadingPage from './pages/auth/LoadingPage'
import { useSimulation } from './hooks/useSimulation'
import { useLocation } from 'react-router-dom'
import { ToastContainer } from './components/shared/ToastContainer'
import { useSystemStore } from './store/systemStore'
import { useActivityStore } from './store/activityStore'
import { ProtectedRoute } from './components/auth/ProtectedRoute'

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Overview', subtitle: 'Portfolio command center' },
  '/orchestrator': { title: 'Orchestrator', subtitle: 'Multi-agent coordination' },
  '/agents/revenue': { title: 'Revenue Agent', subtitle: 'Dynamic pricing & yield management' },
  '/agents/guest': { title: 'Guest Agent', subtitle: 'AI-powered guest communications' },
  '/agents/operations': { title: 'Operations Agent', subtitle: 'Maintenance & housekeeping tasks' },
  '/agents/analytics': { title: 'Analytics Agent', subtitle: 'Market intelligence & reporting' },
  '/agents/marketing': { title: 'Marketing Agent', subtitle: 'Listing optimization & campaigns' },
  '/inputs': { title: 'Inputs', subtitle: 'Data sources & configuration' },
  '/integrations': { title: 'Integrations', subtitle: 'Connected platforms & APIs' },
  '/email-triage': { title: 'Email Triage', subtitle: 'AI-categorized inbox' },
  '/analytics': { title: 'Analytics', subtitle: 'Performance insights' },
  '/settings': { title: 'Settings', subtitle: 'Security · API Keys · Team · System' },
}

function Shell() {
  useSimulation()
  const location = useLocation()
  const initSystem = useSystemStore(s => s.initFromBackend)
  const initActivity = useActivityStore(s => s.initFromBackend)

  useEffect(() => {
    initSystem()
    initActivity()
  }, [initSystem, initActivity])
  const page = PAGE_TITLES[location.pathname] ?? { title: 'CORTEX' }
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex w-full min-h-screen grid-bg" style={{ background: 'var(--bg-base)' }}>
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar title={page.title} subtitle={page.subtitle} onSidebarToggle={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto p-5">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/orchestrator" element={<OrchestratorPage />} />
            <Route path="/agents/revenue" element={<RevenuePage />} />
            <Route path="/agents/guest" element={<GuestPage />} />
            <Route path="/agents/operations" element={<OperationsPage />} />
            <Route path="/agents/analytics" element={<AnalyticsPage />} />
            <Route path="/agents/marketing" element={<MarketingPage />} />
            <Route path="/inputs" element={<InputsPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/email-triage" element={<EmailTriagePage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/loading" element={<ProtectedRoute><LoadingPage /></ProtectedRoute>} />
        <Route path="/*" element={<ProtectedRoute><Shell /></ProtectedRoute>} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  )
}
