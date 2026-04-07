import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { BOOKING_SOURCES } from '../../data/mockData'

export function BookingSourcePie() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={BOOKING_SOURCES}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {BOOKING_SOURCES.map((entry, i) => (
            <Cell key={i} fill={entry.color} opacity={0.9} />
          ))}
        </Pie>
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
          formatter={(v) => [`${v}%`, 'Share']}
        />
        <Legend
          formatter={(value) => <span style={{ color: 'var(--t2)', fontSize: 11 }}>{value}</span>}
          iconSize={8}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
