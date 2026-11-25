import React from 'react';

// One-pager "Financial Report" — grafik SVG ringan (tanpa recharts) bergaya laporan bulanan.
export const RC = {
  bg: '#f4efd9', band: '#e6ddb6', track: '#eae1b8', orange: '#db6132', rust: '#763216', brick: '#b4492a',
  teal: '#6fb4aa', tealDark: '#4b7f78', navy: '#2f4752', ink: '#262626', heading: '#6b7d9a', grid: '#d9cfa8',
};
const DONUT_COLORS = [RC.teal, RC.tealDark, RC.ink, RC.rust, RC.brick, RC.orange, '#c9b98a', '#e9a15f'];
const fmtCompact = n => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);
const niceMax = v => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };

export function Band({ title, tone = 'dark' }) {
  return <div className={`rp-band ${tone === 'blue' ? 'rp-band-blue' : ''}`}><h3>{title}</h3></div>;
}
export function PillBox({ title, children, className = '' }) {
  return <section className={`rp-box ${className}`}><span className="rp-pill">{title}</span><div className="rp-box-body">{children}</div></section>;
}
function Masked() { return <div className="rp-masked">Hidden</div>; }

// Ring 300° (celah di bawah) seperti gauge pada laporan.
export function Gauge({ value, label, sub }) {
  const pct = Number.isFinite(value) ? value : 0;
  const r = 44, c = 2 * Math.PI * r, span = c * 300 / 360;
  const fill = span * Math.max(0, Math.min(1, pct));
  return <figure className="rp-gauge">
    <svg viewBox="0 0 120 120" role="img" aria-label={`${label}: ${Math.round(pct * 100)}%`}>
      <g transform="rotate(120 60 60)">
        <circle cx="60" cy="60" r={r} fill="none" stroke={RC.track} strokeWidth="20" strokeDasharray={`${span} ${c}`}/>
        <circle cx="60" cy="60" r={r} fill="none" stroke={pct > 1 ? RC.rust : RC.orange} strokeWidth="20" strokeDasharray={`${fill} ${c}`}/>
      </g>
      <text x="60" y="66" textAnchor="middle" className="rp-gauge-num">{Number.isFinite(value) ? `${Math.round(pct * 100)}%` : '—'}</text>
    </svg>
    <figcaption><strong>{label}</strong>{sub && <small>{sub}</small>}</figcaption>
  </figure>;
}

export function CashBox({ rows, hidden }) {
  return <div className="rp-cash">{rows.map(r => <div className="rp-cash-row" key={r.label}>
    <span className={`rp-cash-key ${r.accent ? 'accent' : ''}`}>{r.label}</span><span className="rp-cash-val">{hidden ? 'Rp •••••' : r.value}</span>
  </div>)}</div>;
}

// Batang vertikal sederhana (contoh: saldo akhir bulan).
export function VBars({ data, hidden, color = RC.teal, height = 170 }) {
  if (hidden) return <Masked/>;
  const W = 320, H = height, L = 40, B = 24, T = 10;
  const max = niceMax(Math.max(0, ...data.map(d => d.value)));
  const bw = (W - L) / data.length;
  return <svg className="rp-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart">
    {[0, .5, 1].map(f => { const y = T + (H - T - B) * (1 - f); return <g key={f}><text x={L - 6} y={y + 3} textAnchor="end" className="rp-axis">{fmtCompact(max * f)}</text></g>; })}
    <line x1={L} x2={W} y1={H - B} y2={H - B} stroke={RC.ink} strokeWidth="1"/>
    {data.map((d, i) => { const h = (H - T - B) * Math.max(0, d.value) / max; const x = L + i * bw + bw * .3; return <g key={d.label}>
      <rect x={x} y={H - B - h} width={bw * .4} height={h} fill={color}><title>{`${d.label}: ${fmtCompact(d.value)}`}</title></rect>
      <text x={x + bw * .2} y={H - 7} textAnchor="middle" className="rp-axis">{d.label}</text></g>; })}
  </svg>;
}

// Batang bertumpuk + garis (contoh: pengeluaran per kelompok + pemasukan).
export function StackedLine({ data, series, line, hidden, height = 200 }) {
  if (hidden) return <Masked/>;
  const W = 340, H = height, L = 42, B = 24, T = 12;
  const max = niceMax(Math.max(1, ...data.map(d => Math.max(series.reduce((s, k) => s + (d[k.key] || 0), 0), line ? d[line.key] || 0 : 0))));
  const bw = (W - L) / data.length, y = v => T + (H - T - B) * (1 - v / max);
  const pts = line ? data.map((d, i) => [L + i * bw + bw / 2, y(d[line.key] || 0)]) : [];
  return <>
    <div className="rp-legend">{series.map(s => <span key={s.key}><i style={{ background: s.color }}/>{s.label}</span>)}{line && <span><i className="line" style={{ background: line.color }}/>{line.label}</span>}</div>
    <svg className="rp-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Stacked bar chart">
      {[0, .25, .5, .75, 1].map(f => <text key={f} x={L - 6} y={y(max * f) + 3} textAnchor="end" className="rp-axis">{fmtCompact(max * f)}</text>)}
      <line x1={L} x2={W} y1={H - B} y2={H - B} stroke={RC.ink} strokeWidth="1"/>
      {data.map((d, i) => { let acc = 0; const x = L + i * bw + bw * .25; return <g key={d.label}>
        {series.map(s => { const v = d[s.key] || 0; const y1 = y(acc + v), y0 = y(acc); acc += v; return v > 0 ? <rect key={s.key} x={x} y={y1} width={bw * .5} height={y0 - y1} fill={s.color}><title>{`${d.label} · ${s.label}: ${fmtCompact(v)}`}</title></rect> : null; })}
        <text x={L + i * bw + bw / 2} y={H - 7} textAnchor="middle" className="rp-axis">{d.label}</text></g>; })}
      {line && <><polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={line.color} strokeWidth="1.6"/>
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.6" fill={RC.bg} stroke={line.color} strokeWidth="1.5"><title>{`${data[i].label} · ${line.label}: ${fmtCompact(data[i][line.key])}`}</title></circle>)}</>}
    </svg>
  </>;
}

// Donut dengan label di luar + garis penunjuk.
export function DonutLabels({ data, hidden, centerLabel }) {
  if (hidden) return <Masked/>;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="rp-masked">No spending yet</div>;
  const W = 340, H = 210, cx = W / 2, cy = H / 2, R = 62, r = 38;
  let a0 = -Math.PI / 2;
  const segs = data.map((d, i) => { const a = d.value / total * Math.PI * 2; const s = { ...d, a0, a1: a0 + a, color: DONUT_COLORS[i % DONUT_COLORS.length], pct: d.value / total }; a0 += a; return s; });
  const pt = (a, rad) => [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  const arc = s => { const [x0, y0] = pt(s.a0, R), [x1, y1] = pt(s.a1, R), [x2, y2] = pt(s.a1, r), [x3, y3] = pt(s.a0, r); const big = s.a1 - s.a0 > Math.PI ? 1 : 0; return `M${x0},${y0}A${R},${R} 0 ${big} 1 ${x1},${y1}L${x2},${y2}A${r},${r} 0 ${big} 0 ${x3},${y3}Z`; };
  // susun label kiri/kanan agar tidak bertumpuk
  const labels = segs.map(s => { const m = (s.a0 + s.a1) / 2; return { ...s, m, right: Math.cos(m) >= 0, y: pt(m, R + 14)[1] }; });
  ['L', 'R'].forEach(side => { const g = labels.filter(l => l.right === (side === 'R')).sort((a, b) => a.y - b.y); for (let i = 1; i < g.length; i++) if (g[i].y - g[i - 1].y < 15) g[i].y = g[i - 1].y + 15; const over = g.length ? g[g.length - 1].y - (H - 8) : 0; if (over > 0) g.forEach(l => { l.y -= over; }); });
  return <svg className="rp-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Spending breakdown donut">
    {segs.map(s => <path key={s.name} d={arc(s)} fill={s.color} stroke={RC.bg} strokeWidth="1"><title>{`${s.name}: ${Math.round(s.pct * 100)}%`}</title></path>)}
    {segs.map(s => { if (s.pct < .06) return null; const [x, y] = pt((s.a0 + s.a1) / 2, (R + r) / 2); return <text key={s.name} x={x} y={y + 3} textAnchor="middle" className="rp-seg-pct">{(s.pct * 100).toFixed(0)}%</text>; })}
    <circle cx={cx} cy={cy} r={r - 1} fill="#fbf8ec"/>
    {centerLabel && <text x={cx} y={cy + 4} textAnchor="middle" className="rp-center">{centerLabel}</text>}
    {labels.map(l => { const [ex, ey] = pt(l.m, R + 4); const lx = l.right ? cx + R + 30 : cx - R - 30; const tx = l.right ? lx + 5 : lx - 5; return <g key={l.name}>
      <polyline points={`${ex},${ey} ${(ex + lx) / 2},${l.y} ${lx},${l.y}`} fill="none" stroke="#555" strokeWidth=".8"/>
      <text x={tx} y={l.y + 3.5} textAnchor={l.right ? 'start' : 'end'} className={`rp-label ${l.color === RC.teal || l.color === RC.tealDark ? 'teal' : ''}`}>{l.name.length > 16 ? l.name.slice(0, 15) + '…' : l.name}</text></g>; })}
  </svg>;
}

// Rincian biaya: batang aktual (oranye) + titik budget (teal).
export function BudgetBars({ rows, hidden }) {
  if (hidden) return <Masked/>;
  if (!rows.length) return <div className="rp-masked">No budget lines for this month</div>;
  const max = niceMax(Math.max(1, ...rows.map(r => Math.max(r.actual, r.budget))));
  const ticks = [0, .25, .5, .75, 1];
  return <div className="rp-bbars">
    <div className="rp-legend right"><span><i style={{ background: RC.teal }}/>Budget</span><span><i style={{ background: RC.orange }}/>Actual</span></div>
    {rows.map(r => <div className="rp-bb-row" key={r.name}>
      <span className="rp-bb-name" title={r.name}>{r.name}</span>
      <span className="rp-bb-track">
        <i className={`rp-bb-bar ${r.budget && r.actual > r.budget ? 'over' : ''}`} style={{ width: `${r.actual / max * 100}%` }} title={`Actual ${fmtCompact(r.actual)}`}/>
        {r.budget > 0 && <b className="rp-bb-dot" style={{ left: `${r.budget / max * 100}%` }} title={`Budget ${fmtCompact(r.budget)}`}/>}
      </span>
    </div>)}
    <div className="rp-bb-row axis"><span className="rp-bb-name"/><span className="rp-bb-track">{ticks.map(t => <em key={t} style={{ left: `${t * 100}%` }}>{fmtCompact(max * t)}</em>)}</span></div>
  </div>;
}
