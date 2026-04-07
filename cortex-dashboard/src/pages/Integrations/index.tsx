import { RefreshCw, ExternalLink } from 'lucide-react'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PulsingDot } from '../../components/shared/PulsingDot'
import { INTEGRATIONS } from '../../data/mockData'

const browserScripts = [
  { id: 'bs1', name: 'Competitor Rate Scraper', target: 'airbnb.com + vrbo.com', schedule: 'Every 6h', lastRun: '3h ago', status: 'active' },
  { id: 'bs2', name: 'PriceLabs Data Extractor', target: 'pricelabs.co', schedule: 'Daily 2am', lastRun: '12h ago', status: 'active' },
  { id: 'bs3', name: 'Google Reviews Monitor', target: 'google.com/maps', schedule: 'Daily 9am', lastRun: '1d ago', status: 'paused' },
  { id: 'bs4', name: 'Listing Score Checker', target: 'airbnb.com', schedule: 'Weekly Wed', lastRun: '5d ago', status: 'paused' },
]

export function IntegrationsPage() {
  return (
    <PageWrapper title="Integrations" subtitle="Connected platforms · API management · Browser automation">
      {/* Integration cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {INTEGRATIONS.map(intg => (
          <div
            key={intg.id}
            className="card"
            style={{
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              borderColor: intg.status === 'connected' ? 'rgba(201,148,58,0.22)' : intg.status === 'error' ? 'rgba(242,93,93,0.25)' : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14,
                  background: 'rgba(201,148,58,0.1)', color: 'var(--gold)',
                }}
              >
                {intg.icon}
              </div>
              <PulsingDot status={intg.status === 'connected' ? 'active' : intg.status === 'error' ? 'error' : 'idle'} size={7} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>{intg.name}</div>
              <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.55, color: 'var(--t3)' }}>{intg.description}</div>
            </div>
            <div style={{ marginTop: 'auto' }}>
              <StatusBadge status={intg.status as 'connected' | 'disconnected' | 'error'} />
              <div style={{ fontSize: 12, marginTop: 5, color: 'var(--t3)' }}>Last sync: {intg.lastSync}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <RefreshCw size={11} /> Sync
              </button>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <ExternalLink size={11} /> Open
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Browser Automation */}
      <div className="card" style={{ padding: '18px 20px', marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--t1)' }}>Browser Automation Scripts (Apify)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Script Name</th>
                <th>Target</th>
                <th>Schedule</th>
                <th>Last Run</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {browserScripts.map(s => (
                <tr key={s.id}>
                  <td style={{ color: 'var(--t1)', fontWeight: 500 }}>{s.name}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--gold)' }}>{s.target}</td>
                  <td>{s.schedule}</td>
                  <td style={{ color: 'var(--t3)' }}>{s.lastRun}</td>
                  <td><StatusBadge status={s.status === 'active' ? 'active' : 'paused'} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm">Run Now</button>
                      <button className="btn btn-ghost btn-sm">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* API Health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { name: 'Airbnb API', endpoint: 'api.airbnb.com/v2', latency: '142ms', uptime: '99.9%', color: 'var(--green)' },
          { name: 'PriceLabs API', endpoint: 'api.pricelabs.co/v1', latency: '89ms', uptime: '100%', color: 'var(--green)' },
          { name: 'OpenRouter API', endpoint: 'openrouter.ai/api/v1', latency: '1.2s', uptime: '99.7%', color: 'var(--mist)' },
        ].map(api => (
          <div key={api.name} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <PulsingDot status="active" size={7} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>{api.name}</span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, marginBottom: 14, color: 'var(--t3)' }}>{api.endpoint}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div className="metric-value" style={{ fontSize: 18, fontWeight: 700, color: api.color }}>{api.latency}</div>
                <div style={{ fontSize: 12, marginTop: 3, color: 'var(--t3)' }}>Latency</div>
              </div>
              <div>
                <div className="metric-value" style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{api.uptime}</div>
                <div style={{ fontSize: 12, marginTop: 3, color: 'var(--t3)' }}>Uptime</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  )
}
