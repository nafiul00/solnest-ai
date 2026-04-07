import { PageWrapper } from '../../components/layout/PageWrapper'
import { AgentCard } from '../../components/shared/AgentCard'
import { RevenueChart } from '../../components/charts/RevenueChart'
import { OccupancyChart } from '../../components/charts/OccupancyChart'
import { BookingSourcePie } from '../../components/charts/BookingSourcePie'
import { SentimentTrend } from '../../components/charts/SentimentTrend'
import { useSystemStore } from '../../store/systemStore'
import { REVENUE_DATA, PRICING_RULES } from '../../data/mockData'

export function AnalyticsPage() {
  const agents = useSystemStore(s => s.agents)
  const analyticsAgent = agents.find(a => a.id === 'a4')!

  const revLast30 = REVENUE_DATA.slice(-30).reduce((s, d) => s + d.revenue, 0)
  const revPrev30 = REVENUE_DATA.slice(-60, -30).reduce((s, d) => s + d.revenue, 0)
  const revGrowth = (((revLast30 - revPrev30) / revPrev30) * 100).toFixed(1)
  const avgOcc = Math.round(PRICING_RULES.reduce((s, r) => s + r.occupancy, 0) / PRICING_RULES.length)
  const avgADR = Math.round(REVENUE_DATA.slice(-7).reduce((s, d) => s + d.adr, 0) / 7)
  const revPAR = Math.round(avgADR * (avgOcc / 100))

  return (
    <PageWrapper title="Analytics Agent" subtitle="Market intelligence · Revenue analytics · Performance reports">
      <div className="grid grid-cols-4 gap-4 mb-5">
        <div>
          <AgentCard agent={analyticsAgent} compact />
        </div>
        {[
          { label: 'Revenue (30d)', value: `$${Math.round(revLast30 / 1000)}k`, sub: `+${revGrowth}% vs prior period`, color: 'var(--mist)' },
          { label: 'Portfolio RevPAR', value: `$${revPAR}`, sub: `${avgOcc}% avg occupancy`, color: 'var(--green)' },
          { label: 'Avg ADR (7d)', value: `$${avgADR}`, sub: 'All 8 properties', color: 'var(--amber)' },
        ].map(m => (
          <div key={m.label} className="card p-4">
            <div style={{ fontSize: 12, letterSpacing: '0.01em', marginBottom: 8, color: 'var(--t3)' }}>{m.label}</div>
            <div className="metric-value" style={{ fontSize: 24, fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 12, marginTop: 4, color: 'var(--t3)' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="card p-4">
          <h3 style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.01em', marginBottom: 14, color: 'var(--t3)' }}>Revenue Trend (90 days)</h3>
          <RevenueChart days={90} />
        </div>
        <div className="card p-4">
          <h3 style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.01em', marginBottom: 14, color: 'var(--t3)' }}>Occupancy by Property</h3>
          <OccupancyChart />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="card p-4">
          <h3 style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.01em', marginBottom: 14, color: 'var(--t3)' }}>Guest Sentiment Trend (30 days)</h3>
          <SentimentTrend />
        </div>
        <div className="card p-4">
          <h3 style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.01em', marginBottom: 14, color: 'var(--t3)' }}>Booking Source Distribution</h3>
          <BookingSourcePie />
        </div>
      </div>
    </PageWrapper>
  )
}
