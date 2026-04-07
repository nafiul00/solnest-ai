import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const data = Array.from({ length: 30 }, (_, i) => ({
  day: `Apr ${i + 1}`,
  sentiment: Math.round(82 + Math.sin(i * 0.4) * 8 + Math.random() * 6),
  guestScore: Math.round(4.2 + Math.sin(i * 0.3) * 0.4 + Math.random() * 0.3, ),
}))

export function SentimentTrend() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,10,9,0.07)" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: '#6B6B62', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
        <YAxis domain={[60, 100]} tick={{ fill: '#6B6B62', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
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
          formatter={(v) => [`${v}%`, 'Positive Sentiment']}
        />
        <ReferenceLine y={80} stroke="rgba(26,122,68,0.35)" strokeDasharray="4 4" label={{ value: 'Target 80%', fill: '#1A7A44', fontSize: 10, position: 'right' }} />
        <Line type="monotone" dataKey="sentiment" stroke="#1A7A44" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#1A7A44', stroke: '#fff', strokeWidth: 2 }} name="Sentiment" />
      </LineChart>
    </ResponsiveContainer>
  )
}
