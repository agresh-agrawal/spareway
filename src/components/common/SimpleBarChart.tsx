import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

export interface BarDatum {
  label: string
  value: number
}

/** One series, labelled bars, no grid clutter. */
export function SimpleBarChart({
  data,
  format = (v) => String(v),
  height = 180,
  ariaLabel,
}: {
  data: BarDatum[]
  format?: (v: number) => string
  height?: number
  ariaLabel: string
}) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#a1a1a8', fontSize: 13 }}
            interval="preserveStartEnd"
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{ background: '#232327', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#f2f2f3' }}
            labelStyle={{ color: '#a1a1a8' }}
            formatter={(v) => [format(Number(v)), '']}
            separator=""
          />
          <Bar dataKey="value" fill="#22d3ee" radius={[6, 6, 2, 2]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
