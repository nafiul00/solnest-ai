import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { PROPERTIES, PRICING_RULES } from '../../data/mockData'

export function OccupancyChart() {
  const data = PROPERTIES.map(p => {
    const rule = PRICING_RULES.find(r => r.propertyId === p.id)
    return { name: p.name.split(' ').slice(0, 2).join(' '), occupancy: rule?.occupancy ?? 80, color: p.color }
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barSize={24}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,10,9,0.07)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#6B6B62', fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: '#6B6B62', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
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
          formatter={(v) => [`${v}%`, 'Occupancy']}
        />
        <Bar dataKey="occupancy" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
