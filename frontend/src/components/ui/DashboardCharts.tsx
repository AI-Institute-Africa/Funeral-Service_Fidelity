import './dashboard-charts.css'

export type ChartDatum = { label: string; value: number }

const palette = [
  'var(--dashboard-chart-1)',
  'var(--dashboard-chart-2)',
  'var(--dashboard-chart-3)',
  'var(--dashboard-chart-4)',
  'var(--dashboard-chart-5)',
  'var(--dashboard-chart-6)',
]

type ChartProps = {
  title: string
  subtitle?: string
  data: ChartDatum[]
  formatValue?: (value: number) => string
}

const defaultFormat = (value: number) => String(value)

export function DonutChart({ title, subtitle, data, formatValue = defaultFormat }: ChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const circumference = 2 * Math.PI * 38
  const segments = data.map((item, index) => ({
    item,
    segment: total > 0 ? (item.value / total) * circumference : 0,
    offset: data.slice(0, index).reduce((sum, prior) => sum + (total > 0 ? (prior.value / total) * circumference : 0), 0),
  }))

  return (
    <figure className="dashboard-chart">
      <figcaption className="dashboard-chart__caption">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </figcaption>
      {total > 0 ? (
        <div className="dashboard-chart__donut-layout">
          <svg className="dashboard-chart__donut" viewBox="0 0 100 100" role="img" aria-label={`${title}: ${data.map((item) => `${item.label} ${formatValue(item.value)}`).join(', ')}`}>
            <circle className="dashboard-chart__donut-track" cx="50" cy="50" r="38" />
            {segments.map(({ item, segment, offset }, index) => (
                <circle
                  key={item.label}
                  className="dashboard-chart__donut-segment"
                  cx="50"
                  cy="50"
                  r="38"
                  stroke={palette[index % palette.length]}
                  strokeDasharray={`${segment} ${circumference - segment}`}
                  strokeDashoffset={-offset}
                >
                  <title>{`${item.label}: ${formatValue(item.value)}`}</title>
                </circle>
            ))}
            <text className="dashboard-chart__total" x="50" y="48" textAnchor="middle">{total}</text>
            <text className="dashboard-chart__total-label" x="50" y="59" textAnchor="middle">total</text>
          </svg>
          <ul className="dashboard-chart__legend">
            {data.map((item, index) => (
              <li key={item.label}>
                <span className="dashboard-chart__swatch" style={{ backgroundColor: palette[index % palette.length] }} aria-hidden="true" />
                <span className="dashboard-chart__legend-label">{item.label}</span>
                <strong>{formatValue(item.value)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="dashboard-chart__empty">No records to chart yet.</p>
      )}
    </figure>
  )
}

export function BarChart({ title, subtitle, data, formatValue = defaultFormat }: ChartProps) {
  const max = Math.max(1, ...data.map((item) => item.value))

  return (
    <figure className="dashboard-chart">
      <figcaption className="dashboard-chart__caption">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </figcaption>
      {data.length > 0 ? (
        <ul className="dashboard-chart__bars">
          {data.map((item, index) => (
            <li key={item.label}>
              <span className="dashboard-chart__bar-label">{item.label}</span>
              <span
                className="dashboard-chart__bar-track"
                role="progressbar"
                aria-label={item.label}
                aria-valuenow={item.value}
                aria-valuemin={0}
                aria-valuemax={max}
              >
                <span
                  className="dashboard-chart__bar-fill"
                  style={{ width: `${(item.value / max) * 100}%`, backgroundColor: palette[index % palette.length] }}
                />
              </span>
              <strong>{formatValue(item.value)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dashboard-chart__empty">No records to chart yet.</p>
      )}
    </figure>
  )
}

export function LineChart({ title, subtitle, data, formatValue = defaultFormat }: ChartProps) {
  const max = Math.max(1, ...data.map((item) => item.value))
  const left = 22
  const right = 338
  const top = 14
  const bottom = 126
  const x = (index: number) => (data.length < 2 ? (left + right) / 2 : left + (index / (data.length - 1)) * (right - left))
  const y = (value: number) => bottom - (value / max) * (bottom - top)
  const points = data.map((item, index) => `${x(index)},${y(item.value)}`).join(' ')
  const area = data.length ? `M ${x(0)},${bottom} L ${data.map((item, index) => `${x(index)},${y(item.value)}`).join(' L ')} L ${x(data.length - 1)},${bottom} Z` : ''

  return (
    <figure className="dashboard-chart">
      <figcaption className="dashboard-chart__caption">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </figcaption>
      {data.length > 0 ? (
        <svg className="dashboard-chart__line" viewBox="0 0 360 166" role="img" aria-label={`${title}: ${data.map((item) => `${item.label} ${formatValue(item.value)}`).join(', ')}`}>
          {[0, 0.5, 1].map((fraction) => {
            const gridY = bottom - fraction * (bottom - top)
            return <line key={fraction} className="dashboard-chart__gridline" x1={left} x2={right} y1={gridY} y2={gridY} />
          })}
          <path className="dashboard-chart__area" d={area} />
          {data.length > 1 && <polyline className="dashboard-chart__line-path" points={points} />}
          {data.map((item, index) => (
            <g key={`${item.label}-${index}`}>
              <circle className="dashboard-chart__point" cx={x(index)} cy={y(item.value)} r="4">
                <title>{`${item.label}: ${formatValue(item.value)}`}</title>
              </circle>
              <text className="dashboard-chart__axis-label" x={x(index)} y="151" textAnchor="middle">{item.label}</text>
            </g>
          ))}
        </svg>
      ) : (
        <p className="dashboard-chart__empty">No records to chart yet.</p>
      )}
    </figure>
  )
}
