import { useNavigate } from 'react-router-dom'
import { DollarSign, Calendar, Percent, TrendingUp, Star, CheckSquare, Clock, Zap } from 'lucide-react'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { SolnestChatbot } from '../../components/chatbot/SolnestChatbot'
import { MetricCard } from '../../components/shared/MetricCard'
import { AgentCard } from '../../components/shared/AgentCard'
import { LiveFeed } from '../../components/shared/LiveFeed'
import { PulsingDot } from '../../components/shared/PulsingDot'
import { RingGauge } from '../../components/shared/RingGauge'
import { MiniChart } from '../../components/ui/mini-chart'
import { useSystemStore } from '../../store/systemStore'
import { useActivityStore } from '../../store/activityStore'
import { useSchedulerStore } from '../../store/schedulerStore'
import { useCountdown } from '../../hooks/useScheduler'
import { REVENUE_DATA, PRICING_RULES } from '../../data/mockData'

function JobRow({ job }: { job: { id: string; name: string; nextRun: string; status: string; agent: string } }) {
  const countdown = useCountdown(job.name === 'Email Triage' ? 'email-triage' : job.nextRun)
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 0',
      borderBottom: '1px solid rgba(160, 200, 150, 0.06)',
    }}>
      <PulsingDot status={job.status === 'active' ? 'active' : job.status === 'paused' ? 'idle' : 'error'} size={8} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--t1)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {job.name}
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{job.agent}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className="metric-value" style={{ fontSize: 13, fontWeight: 700, color: job.status === 'paused' ? 'var(--t3)' : 'var(--gold)' }}>
          {job.status === 'paused' ? 'Paused' : countdown}
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>next run</div>
      </div>
    </div>
  )
}

export function OverviewPage() {
  const { agents, systemHealth } = useSystemStore()
  const { entries } = useActivityStore()
  const { jobs } = useSchedulerStore()
  const navigate = useNavigate()

  // KPI calculations
  const revMTD = REVENUE_DATA.slice(-30).reduce((sum, d) => sum + d.revenue, 0)
  const avgOcc = Math.round(PRICING_RULES.reduce((sum, r) => sum + r.occupancy, 0) / PRICING_RULES.length)
  const avgADR = Math.round(REVENUE_DATA.slice(-7).reduce((sum, d) => sum + d.adr, 0) / 7)
  const activeBookings = 14
  const pendingTasks = 7

  // Weekly chart data (last 7 days)
  const weekRevData = REVENUE_DATA.slice(-7).map(d => ({ label: d.date, value: d.revenue }))
  const weekOccData = REVENUE_DATA.slice(-7).map(d => ({ label: d.date, value: d.occupancy }))
  const weekADRData = REVENUE_DATA.slice(-7).map(d => ({ label: d.date, value: d.adr }))

  return (
    <PageWrapper title="Solnest Stays" subtitle="Real-time STR operations across 8 properties · 3 markets" actions={<SolnestChatbot />}>
      <div className="space-y-5">
        {/* Row 1: KPI Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          <MetricCard
            label="Revenue MTD"
            value={`$${Math.round(revMTD / 1000).toLocaleString()}k`}
            change="18.4%"
            changePositive
            icon={<DollarSign size={16} />}
            accentColor="var(--gold)"
          />
          <MetricCard
            label="Active Bookings"
            value={activeBookings}
            change="3"
            changePositive
            icon={<Calendar size={16} />}
            accentColor="var(--sage)"
          />
          <MetricCard
            label="Occupancy"
            value={`${avgOcc}%`}
            change="4.2%"
            changePositive
            icon={<Percent size={16} />}
            accentColor="var(--mist)"
          />
          <MetricCard
            label="ADR"
            value={`$${avgADR}`}
            change="$22"
            changePositive
            icon={<TrendingUp size={16} />}
            accentColor="var(--terracotta)"
          />
          <MetricCard
            label="Guest Score"
            value="4.87"
            change="0.12"
            changePositive
            icon={<Star size={16} />}
            accentColor="var(--gold-hi)"
            animate={false}
          />
          <MetricCard
            label="Pending Tasks"
            value={pendingTasks}
            icon={<CheckSquare size={16} />}
            accentColor="var(--purple)"
          />
        </div>

        {/* Row 2: Weekly Performance Mini Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Revenue — 7 days', data: weekRevData, color: 'var(--gold)', formatValue: (v: number) => `$${(v / 1000).toFixed(1)}k` },
            { label: 'Occupancy — 7 days', data: weekOccData, color: 'var(--sage)', formatValue: (v: number) => `${v}%` },
            { label: 'ADR — 7 days', data: weekADRData, color: 'var(--mist)', formatValue: (v: number) => `$${v}` },
          ].map(chart => (
            <div key={chart.label} className="card p-4">
              <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--t3)', marginBottom: 10 }}>{chart.label}</div>
              <MiniChart data={chart.data} color={chart.color} formatValue={chart.formatValue} />
            </div>
          ))}
        </div>

        {/* Rows 3+4: Agent Grid / Live Feed (left) + Operator / Scheduler (right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, alignItems: 'start' }}>

          {/* Left column: Agent Grid + Live Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Agent Grid */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--t3)' }}>
                  Agent Status
                </h2>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--t3)' }}>
                  {agents.filter(a => a.status === 'active').length}/{agents.length} active
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {agents.slice(0, 3).map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    compact
                    onClick={() => {
                      const routes: Record<string, string> = { a1: '/agents/revenue', a2: '/agents/guest', a3: '/agents/operations', a4: '/agents/analytics', a5: '/agents/marketing' }
                      navigate(routes[agent.id] ?? '/')
                    }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {agents.slice(3).map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    compact
                    onClick={() => {
                      const routes: Record<string, string> = { a4: '/agents/analytics', a5: '/agents/marketing' }
                      navigate(routes[agent.id] ?? '/')
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Live Feed */}
            <div className="card overflow-hidden">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <Zap size={14} style={{ color: 'var(--gold)' }} />
                <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--t1)' }}>
                  Live Activity Feed
                </h2>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--t3)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sage)', display: 'inline-block', animation: 'pulse-green 2s infinite' }} />
                  Live
                </span>
              </div>
              <LiveFeed entries={entries} maxHeight="280px" autoScroll />
            </div>
          </div>

          {/* Right column: Primary Operator + Scheduler Jobs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Primary Operator */}
            <div
              className="card p-4 flex flex-col"
              style={{ borderColor: 'rgba(201, 148, 58, 0.22)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <PulsingDot status="active" size={8} />
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--gold)' }}>
                  Primary Operator
                </span>
              </div>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 3, color: 'var(--t1)' }}>
                Claude Sonnet 4
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginBottom: 16, color: 'var(--t3)' }}>
                claude-sonnet-4 · OpenRouter
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { val: '1,847', label: 'Cycles Today', color: 'var(--gold)' },
                  { val: '4.2s',  label: 'Avg Latency',  color: 'var(--sage)' },
                  { val: '2.4M',  label: 'Tokens Used',  color: 'var(--mist)' },
                  { val: '99.7%', label: 'Uptime',       color: 'var(--terracotta)' },
                ].map(({ val, label, color }) => (
                  <div key={label}>
                    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{val}</div>
                    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center mb-3">
                <RingGauge
                  value={systemHealth.score}
                  size={72}
                  strokeWidth={6}
                  color="var(--gold)"
                  label={`${systemHealth.score}%`}
                  sublabel="Health"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-auto">
                {(['apiStatus', 'dbStatus', 'webhookStatus'] as const).map(key => (
                  <div key={key} className="text-center">
                    <PulsingDot status={systemHealth[key]} size={7} />
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, marginTop: 5, textTransform: 'capitalize', color: 'var(--t3)' }}>
                      {key.replace('Status', '')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scheduler Jobs */}
            <div className="card overflow-hidden">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <Clock size={14} style={{ color: 'var(--gold)' }} />
                <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--t1)' }}>
                  Scheduled Jobs
                </h2>
                <span
                  style={{ marginLeft: 'auto', fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--gold)', cursor: 'pointer' }}
                  onClick={() => navigate('/inputs')}
                >
                  View all
                </span>
              </div>
              <div style={{ padding: '4px 16px' }}>
                {jobs.map(job => <JobRow key={job.id} job={job} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
