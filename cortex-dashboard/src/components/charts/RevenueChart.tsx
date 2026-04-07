import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { REVENUE_DATA } from '../../data/mockData'

interface RevenueChartProps {
  days?: number
}

export function RevenueChart({ days = 30 }: RevenueChartProps) {
  const data = REVENUE_DATA.slice(-days)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#D4920A" stopOpacity={0.22} />
            <stop offset="95%" stopColor="#D4920A" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="occ2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#1A7A44" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#1A7A44" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,10,9,0.07)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#6B6B62', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={Math.floor(days / 6)}
        />
        <YAxis
          tick={{ fill: '#6B6B62', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
        />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid rgba(10,10,9,0.12)',
            borderRadius: 8,
            fontSize: 12,
            boxShadow: '0 4px 16px rgba(10,10,9,0.10)',
          }}
          labelStyle={{ color: '#2D2D2A', fontWeight: 600 }}
          itemStyle={{ color: '#0A0A09' }}
          formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#6B6B62' }} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#D4920A"
          strokeWidth={2.5}
          fill="url(#revGrad)"
          name="Revenue"
          dot={false}
          activeDot={{ r: 4, fill: '#D4920A', stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
