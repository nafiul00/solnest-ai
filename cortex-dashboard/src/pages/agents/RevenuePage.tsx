import { useState } from 'react'
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { AgentCard } from '../../components/shared/AgentCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { useSystemStore } from '../../store/systemStore'
import { PROPERTIES, BOOKING_CALENDARS, PRICING_RULES } from '../../data/mockData'
import clsx from 'clsx'

const statusColors: Record<string, string> = {
  booked:    '#1A7A44',
  blocked:   '#6B6B62',
  available: '#AAAAAA',
  pending:   '#D4920A',
}
const statusBg: Record<string, string> = {
  booked:    'rgba(26,122,68,0.10)',
  blocked:   'rgba(10,10,9,0.06)',
  available: '#FFFFFF',
  pending:   'rgba(212,146,10,0.10)',
}
const statusBorder: Record<string, string> = {
  booked:    'rgba(26,122,68,0.40)',
  blocked:   'rgba(10,10,9,0.16)',
  available: 'rgba(10,10,9,0.11)',
  pending:   'rgba(212,146,10,0.50)',
}
const statusStrip: Record<string, string> = {
  booked:    '#1A7A44',
  blocked:   '#9B9B90',
  available: 'transparent',
  pending:   '#D4920A',
}

function PricingCalendar({ propertyId }: { propertyId: string }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const days = BOOKING_CALENDARS[propertyId] ?? []
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
      {days.map(day => {
        const isHov = hovered === day.date
        return (
          <div
            key={day.date}
            onMouseEnter={() => setHovered(day.date)}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: statusBg[day.status],
              border: `1px solid ${isHov ? statusColors[day.status] : statusBorder[day.status]}`,
              borderRadius: 6,
              overflow: 'hidden',
              textAlign: 'center',
              cursor: 'default',
              transition: 'border-color 0.15s, transform 0.1s, box-shadow 0.15s',
              transform: isHov ? 'scale(1.06)' : 'scale(1)',
              boxShadow: isHov ? `0 2px 10px ${statusColors[day.status]}30` : 'none',
              position: 'relative',
              zIndex: isHov ? 2 : 1,
            }}
            title={`${day.date} · $${day.price} · ${day.status}${day.guestName ? ` · ${day.guestName}` : ''}`}
          >
            {/* Status strip */}
            <div style={{
              height: 3,
              background: statusStrip[day.status],
              opacity: 0.85,
            }} />
            <div style={{ padding: '5px 3px 6px' }}>
              <div style={{ color: statusColors[day.status], fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
                {day.date.slice(8)}
              </div>
              <div style={{ color: 'var(--t1)', fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
                ${day.price}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Property Revenue Breakdown ───────────────────────────────────────────────
function PropertyRevenueRanking() {
  const ranked = PROPERTIES.map(p => {
    const calendar = BOOKING_CALENDARS[p.id] ?? []
    const bookedDays = calendar.filter(d => d.status === 'booked')
    const revenue = bookedDays.reduce((sum, d) => sum + d.price, 0)
    const occ = Math.round((bookedDays.length / calendar.length) * 100)
    const adr = bookedDays.length ? Math.round(revenue / bookedDays.length) : 0
    const rule = PRICING_RULES.find(r => r.propertyId === p.id)
    return { ...p, revenue, occ, adr, bookedDays: bookedDays.length, rule }
  }).sort((a, b) => b.revenue - a.revenue)

  const maxRev = ranked[0]?.revenue || 1

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
        <Trophy size={14} color="var(--amber)" />
        <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--t2)' }}>
          Revenue by Property
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t3)' }}>30-day · ranked</span>
      </div>

      <div style={{ padding: '4px 0' }}>
        {ranked.map((p, i) => {
          const bar = (p.revenue / maxRev) * 100
          const isTop = i === 0
          const trend = i < 3 ? 'up' : i > 5 ? 'down' : 'flat'
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                borderBottom: i < ranked.length - 1 ? '1px solid var(--border)' : 'none',
                background: isTop ? `${p.color}08` : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `${p.color}10`)}
              onMouseLeave={e => (e.currentTarget.style.background = isTop ? `${p.color}08` : 'transparent')}
            >
              {/* Rank */}
              <div style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                background: i === 0 ? 'rgba(245,166,35,0.15)' : i === 1 ? 'rgba(167,139,250,0.12)' : 'rgba(10,10,9,0.05)',
                border: `1px solid ${i === 0 ? '#F5A623' : i === 1 ? '#A78BFA' : 'var(--border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? '#F5A623' : i === 1 ? '#A78BFA' : 'var(--t3)' }}>
                  {i + 1}
                </span>
              </div>

              {/* Color dot + Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  {isTop && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#F5A623', background: 'rgba(245,166,35,0.15)', padding: '1px 5px', borderRadius: 10, border: '1px solid rgba(245,166,35,0.3)', flexShrink: 0 }}>
                      TOP
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(10,10,9,0.08)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${bar}%`,
                      borderRadius: 2,
                      background: p.color,
                      opacity: 0.85,
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: p.color, lineHeight: 1 }}>
                    ${p.revenue.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>revenue</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 38 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', lineHeight: 1 }}>
                    {p.occ}%
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>occ.</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 36 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', lineHeight: 1 }}>
                    ${p.adr}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>ADR</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {trend === 'up' && <TrendingUp size={13} color="var(--green)" />}
                  {trend === 'down' && <TrendingDown size={13} color="var(--red)" />}
                  {trend === 'flat' && <Minus size={13} color="var(--t3)" />}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function RevenuePage() {
  const agents = useSystemStore(s => s.agents)
  const revenueAgent = agents.find(a => a.id === 'a1')!
  const [selectedProp, setSelectedProp] = useState(PROPERTIES[0].id)
  const [rules, setRules] = useState(PRICING_RULES)

  const updateRule = (propId: string, key: string, val: number) => {
    setRules(prev => prev.map(r => r.propertyId === propId ? { ...r, [key]: val } : r))
  }

  return (
    <PageWrapper>
      {/* Top row: agent card + pricing table */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, marginBottom: 16 }}>
        {/* Left: agent + run history */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AgentCard agent={revenueAgent} />
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="section-label" style={{ marginBottom: 10 }}>Run History</div>
            {revenueAgent.runHistory.slice(0, 8).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < 7 ? '1px solid var(--border)' : 'none' }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: r.status === 'success' ? 'var(--green)' : 'var(--red)',
                }} />
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t2)' }}>
                  {r.action}
                </span>
                <span style={{ fontSize: 12, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                  {r.timestamp}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: pricing rules table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
            <span className="section-label">Dynamic Pricing Rules</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Min $</th>
                  <th>Max $</th>
                  <th>Current</th>
                  <th>Occupancy</th>
                  <th>Lead Disc%</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {PROPERTIES.map(prop => {
                  const rule = rules.find(r => r.propertyId === prop.id)!
                  return (
                    <tr
                      key={prop.id}
                      onClick={() => setSelectedProp(prop.id)}
                      style={{ cursor: 'pointer', background: selectedProp === prop.id ? `${prop.color}0A` : 'transparent' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: prop.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{prop.name}</span>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={rule.minPrice}
                          onChange={e => updateRule(prop.id, 'minPrice', Number(e.target.value))}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 70, fontSize: 12, padding: '4px 6px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={rule.maxPrice}
                          onChange={e => updateRule(prop.id, 'maxPrice', Number(e.target.value))}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 70, fontSize: 12, padding: '4px 6px' }}
                        />
                      </td>
                      <td>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: prop.color, fontSize: 13 }}>
                          ${rule.currentPrice}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 56, height: 5, borderRadius: 3, background: 'rgba(10,10,9,0.08)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 3,
                              width: `${rule.occupancy}%`,
                              background: rule.occupancy > 90 ? 'var(--green)' : rule.occupancy > 75 ? 'var(--mist)' : 'var(--amber)',
                            }} />
                          </div>
                          <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--t2)' }}>
                            {rule.occupancy}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={rule.leadTimeDiscount}
                          onChange={e => updateRule(prop.id, 'leadTimeDiscount', Number(e.target.value))}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 56, fontSize: 12, padding: '4px 6px' }}
                        />
                      </td>
                      <td>
                        <StatusBadge
                          status={rule.occupancy > 85 ? 'active' : 'idle'}
                          label={rule.occupancy > 85 ? 'Hot' : 'Normal'}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Middle: Property Revenue Ranking */}
      <div style={{ marginBottom: 16 }}>
        <PropertyRevenueRanking />
      </div>

      {/* Bottom: Pricing Calendar */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', rowGap: 8 }}>
          <span className="section-label" style={{ margin: 0 }}>30-Day Pricing Calendar</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PROPERTIES.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProp(p.id)}
                className={clsx('btn btn-sm')}
                style={{
                  background: selectedProp === p.id ? `${p.color}20` : 'transparent',
                  border: `1px solid ${selectedProp === p.id ? p.color : 'var(--border)'}`,
                  color: selectedProp === p.id ? p.color : 'var(--t3)',
                  fontWeight: selectedProp === p.id ? 600 : 400,
                }}
              >
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {[
              { label: 'Booked',    bg: '#1A7A44',              border: 'none' },
              { label: 'Pending',   bg: '#D4920A',              border: 'none' },
              { label: 'Blocked',   bg: 'rgba(10,10,9,0.25)',   border: 'none' },
              { label: 'Available', bg: 'rgba(10,10,9,0.06)',   border: '1px solid rgba(10,10,9,0.18)' },
            ].map(s => (
              <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--t3)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.bg, border: s.border, flexShrink: 0 }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <PricingCalendar propertyId={selectedProp} />
        </div>
      </div>
    </PageWrapper>
  )
}
