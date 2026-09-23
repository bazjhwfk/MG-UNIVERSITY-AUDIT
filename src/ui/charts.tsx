/** Small hand-drawn SVG charts for the dashboard (no chart library needed). */

const START = 150; // degrees, measured clockwise from 3 o'clock
const SWEEP = 240;

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

export function Gauge({ percent, label }: { percent: number; label: string }) {
  const p = Math.max(0, Math.min(100, percent));
  const end = START + (SWEEP * p) / 100;
  const knob = polar(100, 100, 78, end);
  return (
    <svg className="gauge" viewBox="0 0 200 180" role="img" aria-label={`${label}: ${Math.round(p)}%`}>
      <path d={arc(100, 100, 78, START, START + SWEEP)} className="gauge-track" />
      {p > 0 && <path d={arc(100, 100, 78, START, Math.max(end, START + 0.5))} className="gauge-fill" />}
      <circle cx={knob.x} cy={knob.y} r="8" className="gauge-knob" />
      {[0, 20, 40, 60, 80, 100].map((tick) => {
        const t = polar(100, 100, 96, START + (SWEEP * tick) / 100);
        return <text key={tick} x={t.x} y={t.y} className="gauge-tick" textAnchor="middle" dominantBaseline="middle">{tick === 0 ? '00' : tick}</text>;
      })}
      <text x="100" y="98" className="gauge-value" textAnchor="middle">{Math.round(p)}%</text>
      <text x="100" y="120" className="gauge-label" textAnchor="middle">{label}</text>
    </svg>
  );
}

export function LineChart({ points }: { points: { label: string; value: number }[] }) {
  const w = 300;
  const h = 130;
  const max = Math.max(...points.map((p) => p.value), 1);
  const x = (i: number) => 10 + (i * (w - 20)) / Math.max(points.length - 1, 1);
  const y = (v: number) => h - 12 - (v / max) * (h - 30);
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p.value)}`).join(' ');
  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
        aria-label={points.map((p) => `${p.label}: ${Math.round(p.value)}`).join(', ')}>
        <line x1="0" x2={w} y1={y(max / 2)} y2={y(max / 2)} className="line-guide" />
        <path d={d} className="line-path" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="line-labels">{points.map((p) => <span key={p.label}>{p.label}</span>)}</div>
    </div>
  );
}

export function StatusBars({ bars }: { bars: { label: string; value: number; tone: 'yellow' | 'dark' | 'grey' }[] }) {
  const total = bars.reduce((s, b) => s + b.value, 0);
  return (
    <div className="status-bars">
      {bars.map((b) => {
        const pct = total ? Math.round((b.value / total) * 100) : 0;
        return (
          <div key={b.label} className={`status-bar ${b.tone}`} style={{ height: `${28 + (total ? (b.value / total) * 72 : 0)}%` }}
            title={`${b.label}: ${b.value}`}>
            <span className="bubble">{pct}%</span>
            <span className="bar-label">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}
