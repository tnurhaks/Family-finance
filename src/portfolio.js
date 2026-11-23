// Perhitungan portofolio investasi (tanpa React, supaya mudah dites).
export const ASSET_TYPES = [
  { value: 'stock_idx', label: 'Saham IDX', unit: 'lembar' },
  { value: 'fund', label: 'Reksa dana', unit: 'unit' },
  { value: 'stock_us', label: 'Saham/ETF US', unit: 'share' },
  { value: 'bond', label: 'SBN / obligasi', unit: '' },
  { value: 'property', label: 'Properti (GORO)', unit: '' },
  { value: 'cash', label: 'Kas / RDN', unit: '' },
  { value: 'other', label: 'Lainnya', unit: '' },
];
export const typeLabel = v => (ASSET_TYPES.find(t => t.value === v) || { label: v }).label;
export const INVEST_PLATFORMS = ['Stockbit', 'Bibit', 'Gotrade', 'GORO'];
export const isMarket = h => h.asset_type === 'stock_idx' || h.asset_type === 'stock_us' || h.asset_type === 'fund';
export const priceKey = h =>
  h.asset_type === 'stock_idx' ? `IDX:${String(h.symbol).toUpperCase()}`
  : h.asset_type === 'stock_us' ? `US:${String(h.symbol).toUpperCase()}`
  : h.asset_type === 'fund' && h.fund_id ? `FUND:${h.fund_id}` : null;

// holdings: baris investment_holdings · prices: baris market_prices
export function computePortfolio(holdings = [], prices = []) {
  const px = new Map(prices.map(p => [p.key, p]));
  const fx = Number(px.get('FX:USDIDR')?.price || 0);
  const rows = holdings.map(h => {
    const qty = Number(h.quantity) || 0, avg = Number(h.avg_cost) || 0;
    const rate = h.currency === 'USD' ? fx : 1;
    const key = priceKey(h), p = key ? px.get(key) : null;
    let price = null, value, cost, dayChange = 0, stale = false, asOf = null;
    if (p) {
      price = Number(p.price); value = qty * price * rate; cost = qty * avg * rate; asOf = p.as_of || p.fetched_at;
      const chg = p.change_pct == null ? 0 : Number(p.change_pct) / 100;
      dayChange = chg ? value - value / (1 + chg) : 0;
    } else if (h.manual_value != null) {
      value = Number(h.manual_value); cost = Number(h.manual_cost ?? h.manual_value);
    } else {
      value = qty * avg * rate; cost = value; stale = isMarket(h);
    }
    const pl = value - cost;
    return { ...h, price, value, cost, pl, plPct: cost ? pl / cost : 0, dayChange, stale, asOf, lots: h.asset_type === 'stock_idx' ? qty / 100 : null };
  });
  const total = rows.reduce((s, r) => s + r.value, 0), cost = rows.reduce((s, r) => s + r.cost, 0);
  const dayChange = rows.reduce((s, r) => s + r.dayChange, 0);
  const group = keyFn => {
    const m = new Map();
    for (const r of rows) { const k = keyFn(r); const g = m.get(k) || { key: k, value: 0, cost: 0, dayChange: 0, items: [] }; g.value += r.value; g.cost += r.cost; g.dayChange += r.dayChange; g.items.push(r); m.set(k, g); }
    return [...m.values()].map(g => ({ ...g, pl: g.value - g.cost, plPct: g.cost ? (g.value - g.cost) / g.cost : 0, share: total ? g.value / total : 0 }))
      .sort((a, b) => b.value - a.value);
  };
  const updated = prices.reduce((d, p) => (p.fetched_at && (!d || p.fetched_at > d) ? p.fetched_at : d), null);
  return { rows, total, cost, pl: total - cost, plPct: cost ? (total - cost) / cost : 0, dayChange, dayPct: total - dayChange ? dayChange / (total - dayChange) : 0,
    byPlatform: group(r => r.platform), byType: group(r => typeLabel(r.asset_type)), fx, updated, stale: rows.filter(r => r.stale).length };
}

// portfolio_history → deret total per tanggal (untuk grafik)
export function historySeries(history = []) {
  const m = new Map();
  for (const h of history) { const d = m.get(h.recorded_on) || { date: h.recorded_on, value: 0, cost: 0 }; d.value += Number(h.value); d.cost += Number(h.cost); m.set(h.recorded_on, d); }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}
