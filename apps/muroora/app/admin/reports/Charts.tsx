import { format, money, type Money } from '@/lib/money'

/**
 * Charts drawn as plain SVG and CSS, with no charting library.
 *
 * A charting library is 100kb of JavaScript for a shop that needs a line, some
 * bars and a few proportions, on phones over Zimbabwean mobile data. These
 * render on the server and ship no script at all.
 *
 * Every axis is also written out in words underneath, and every chart is
 * followed by the same numbers as text, so nothing here depends on being able
 * to read a graph or see colour.
 */

/* ------------------------------------------------------------ line chart */

export function SalesChart({
  points,
}: {
  points: { label: string; orders: number; amount: Money }[]
}) {
  const values = points.map((p) => Number(p.amount.amount))
  const peak = Math.max(...values, 1)

  const W = 720
  const H = 200
  const pad = { top: 12, right: 8, bottom: 4, left: 8 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const x = (i: number) =>
    pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => pad.top + innerH - (v / peak) * innerH

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L ${x(values.length - 1).toFixed(1)} ${pad.top + innerH} L ${x(0).toFixed(1)} ${pad.top + innerH} Z`

  const first = points[0]
  const last = points[points.length - 1]

  return (
    <figure className="mt-6">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Daily sales from ${first.label} to ${last.label}. Highest day ${format(money(BigInt(Math.round(peak)), 'USD'))}.`}
          className="h-[200px] w-full min-w-[36rem]"
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={pad.left}
              x2={W - pad.right}
              y1={pad.top + innerH - f * innerH}
              y2={pad.top + innerH - f * innerH}
              stroke="currentColor"
              strokeWidth="1"
              className="text-rule"
            />
          ))}
          <path d={area} className="fill-accent/10" />
          <path d={line} fill="none" strokeWidth="2.5" className="stroke-accent" />
          {values.map((v, i) =>
            v > 0 ? (
              <circle key={i} cx={x(i)} cy={y(v)} r="3" className="fill-accent" />
            ) : null,
          )}
        </svg>
      </div>

      <figcaption className="mt-3 flex flex-wrap justify-between gap-x-6 text-small text-ink-faint">
        <span>{first.label}</span>
        <span>
          Each point is one day. Height is the money taken that day. The top
          gridline is {format(money(BigInt(Math.round(peak)), 'USD'))}.
        </span>
        <span>{last.label}</span>
      </figcaption>
    </figure>
  )
}

/* ------------------------------------------------------------- bar chart */

export function TopProductsChart({
  rows,
}: {
  rows: { name: string; quantity: number; revenue: Money }[]
}) {
  const peak = Math.max(...rows.map((r) => r.quantity), 1)

  return (
    <ul className="mt-6 space-y-3">
      {rows.map((row) => (
        <li key={row.name} className="grid grid-cols-[10rem_1fr_auto] items-center gap-4">
          <span className="truncate text-small font-bold" title={row.name}>
            {row.name}
          </span>
          <span className="h-6 bg-paper-sunk">
            <span
              className="block h-full bg-support"
              style={{ width: `${Math.max(2, (row.quantity / peak) * 100)}%` }}
            />
          </span>
          <span className="font-mono text-small tabular-nums text-ink-soft">
            {row.quantity} sold · {format(row.revenue)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* --------------------------------------------------------- stock health */

export function StockBands({
  bands,
}: {
  bands: { label: string; count: number; tone: 'bad' | 'warn' | 'good' }[]
}) {
  const total = bands.reduce((n, b) => n + b.count, 0)
  const colour = {
    bad: 'bg-accent',
    warn: 'bg-orange-300',
    good: 'bg-support',
  } as const

  if (total === 0) {
    return (
      <p className="mt-6 text-ink-soft">
        No products on sale yet, so there is nothing to measure.
      </p>
    )
  }

  return (
    <div className="mt-6">
      <div className="flex h-8 w-full overflow-hidden border border-rule">
        {bands.map((b) =>
          b.count > 0 ? (
            <span
              key={b.label}
              className={colour[b.tone]}
              style={{ width: `${(b.count / total) * 100}%` }}
              title={`${b.label}: ${b.count}`}
            />
          ) : null,
        )}
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-small">
        {bands.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className={`inline-block size-3 ${colour[b.tone]}`} aria-hidden />
            <dt>{b.label}</dt>
            <dd className="font-mono tabular-nums font-bold">{b.count}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-small text-ink-faint">
        The bar is every product on sale, split by how much is left after stock
        already held for orders.
      </p>
    </div>
  )
}
