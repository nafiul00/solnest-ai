import { PageWrapper } from '../../components/layout/PageWrapper'
import { AgentCard } from '../../components/shared/AgentCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { useSystemStore } from '../../store/systemStore'
import { PROPERTIES } from '../../data/mockData'

const ghlPipeline = [
  { stage: 'New Lead', count: 12, value: '$34,200', color: 'var(--t3)' },
  { stage: 'Contacted', count: 8, value: '$28,800', color: 'var(--purple)' },
  { stage: 'Interested', count: 5, value: '$19,500', color: 'var(--mist)' },
  { stage: 'Quote Sent', count: 4, value: '$16,800', color: 'var(--amber)' },
  { stage: 'Booked', count: 3, value: '$14,400', color: 'var(--green)' },
]

const listingScores = [
  { propertyId: 'p1', score: 87, photos: 18, desc: 94, amenities: 82 },
  { propertyId: 'p2', score: 91, photos: 22, desc: 96, amenities: 88 },
  { propertyId: 'p3', score: 79, photos: 14, desc: 82, amenities: 74 },
  { propertyId: 'p4', score: 73, photos: 12, desc: 78, amenities: 71 },
  { propertyId: 'p5', score: 85, photos: 20, desc: 88, amenities: 80 },
  { propertyId: 'p6', score: 82, photos: 16, desc: 86, amenities: 78 },
  { propertyId: 'p7', score: 88, photos: 19, desc: 91, amenities: 84 },
  { propertyId: 'p8', score: 94, photos: 24, desc: 97, amenities: 91 },
]

export function MarketingPage() {
  const agents = useSystemStore(s => s.agents)
  const marketingAgent = agents.find(a => a.id === 'a5')!

  return (
    <PageWrapper title="Marketing Agent" subtitle="GHL pipeline · Listing optimization · Content generation">
      <div className="grid grid-cols-3 gap-5 mb-5">
        <div>
          <AgentCard agent={marketingAgent} />
          <div className="card p-4 mt-3">
            <h3 style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--t3)', marginBottom: 12 }}>Campaign Performance</h3>
            {[
              { name: 'Spring Tofino Email', sent: '2.4k', opens: '42%', bookings: 8 },
              { name: 'Whistler Ski Season', sent: '3.1k', opens: '38%', bookings: 12 },
              { name: 'Direct Booking Push', sent: '1.8k', opens: '51%', bookings: 6 },
            ].map(c => (
              <div key={c.name} className="py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: 'var(--t1)' }}>{c.name}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--t3)' }}>
                  <span>{c.sent} sent</span>
                  <span style={{ color: 'var(--green)' }}>{c.opens} open</span>
                  <span style={{ color: 'var(--mist)' }}>{c.bookings} bookings</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GHL Pipeline */}
        <div className="col-span-2 card p-4 self-start">
          <h3 style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--t3)', marginBottom: 12 }}>GHL Pipeline</h3>
          <div className="flex gap-2 mb-4">
            {ghlPipeline.map((stage, i) => (
              <div
                key={stage.stage}
                className="flex-1 rounded p-3 text-center"
                style={{ background: `${stage.color}10`, border: `1px solid ${stage.color}30` }}
              >
                <div className="metric-value" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: stage.color }}>{stage.count}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--t1)' }}>{stage.stage}</div>
                <div style={{ fontSize: 12, color: stage.color }}>{stage.value}</div>
                {i < ghlPipeline.length - 1 && (
                  <div style={{ fontSize: 12, marginTop: 4, color: 'var(--t3)' }}>
                    {Math.round((ghlPipeline[i + 1].count / stage.count) * 100)}% →
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>
            Total pipeline value: <span style={{ fontWeight: 700, color: 'var(--gold)' }}>$113,700</span> · Conversion rate: <span style={{ fontWeight: 700, color: 'var(--green)' }}>25%</span>
          </div>
        </div>
      </div>

      {/* Listing Scores */}
      <div className="card p-4">
        <h3 style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--t3)', marginBottom: 16 }}>Listing Quality Scores</h3>
        <div className="grid grid-cols-4 gap-3">
          {PROPERTIES.map((prop, i) => {
            const scores = listingScores[i]
            const overall = scores.score
            const color = overall >= 90 ? 'var(--green)' : overall >= 80 ? 'var(--mist)' : overall >= 70 ? 'var(--amber)' : 'var(--red)'
            return (
              <div key={prop.id} className="card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: prop.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t1)' }}>{prop.name.split(' ').slice(0, 2).join(' ')}</span>
                </div>
                <div className="metric-value" style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, color }}>{overall}</div>
                <div className="w-full rounded-full h-1 mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="rounded-full h-1 transition-all" style={{ width: `${overall}%`, background: color }} />
                </div>
                {[
                  { label: 'Photos', val: scores.photos + ' imgs' },
                  { label: 'Description', val: `${scores.desc}/100` },
                  { label: 'Amenities', val: `${scores.amenities}/100` },
                ].map(m => (
                  <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', color: 'var(--t3)' }}>
                    <span>{m.label}</span>
                    <span style={{ color: 'var(--t2)' }}>{m.val}</span>
                  </div>
                ))}
                <div className="mt-2">
                  <StatusBadge
                    status={overall >= 90 ? 'active' : overall >= 80 ? 'idle' : 'warning'}
                    label={overall >= 90 ? 'Excellent' : overall >= 80 ? 'Good' : 'Needs Work'}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </PageWrapper>
  )
}
