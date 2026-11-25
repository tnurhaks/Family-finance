import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Plus, RefreshCw, Pencil, Search, EyeOff, TrendingUp, AlertTriangle, Check, Trash2 } from 'lucide-react';
import { ASSET_TYPES, INVEST_PLATFORMS, computePortfolio, historySeries, typeLabel, isMarket } from './portfolio';

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const rp = (n, hidden) => (hidden ? 'Rp •••••••' : idr.format(Math.round(Number(n) || 0)));
const num = (n, d = 2) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: d }).format(Number(n) || 0);
const pct = p => `${p >= 0 ? '+' : '−'}${Math.abs(p * 100).toFixed(2)}%`;
const signed = (n, hidden) => (hidden ? '•••' : `${n >= 0 ? '+' : '−'}${idr.format(Math.abs(Math.round(n)))}`);
const tone = n => (n > 0 ? 'gain' : n < 0 ? 'loss' : 'flat');
const when = iso => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const PLATFORM_COLORS = { Stockbit: '#db6132', Bibit: '#6fb4aa', Gotrade: '#e17e57', GORO: '#763216' };
const colorFor = (p, i) => PLATFORM_COLORS[p] || ['#eba88e', '#82c0b8', '#e99f81', '#96a5ad'][i % 4];

export function InvestPage({ holdings, prices, history, hidden, isDemo, onNew, onEdit, onRefresh }) {
  const pf = useMemo(() => computePortfolio(holdings, prices), [holdings, prices]);
  const series = useMemo(() => historySeries(history).map(d => ({ ...d, label: new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) })), [history]);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const [view, setView] = useState('platform');
  async function refresh() { setBusy(true); setMsg(''); try { const r = await onRefresh(); setMsg(r?.prices != null ? `Updated ${r.prices} prices.` : 'Prices updated.'); } catch (e) { setMsg(e.message || 'Could not update prices.'); } finally { setBusy(false); } }
  const groups = view === 'platform' ? pf.byPlatform : pf.byType;

  return <div className="page-stack invest-page">
    <div className="page-intro"><div><span className="eyebrow">INVESTMENTS</span><h2>Your portfolio, live.</h2><p>Stock prices update after the market closes; mutual fund NAVs every morning.</p></div>
      <button className="btn btn-primary desktop-new" onClick={onNew} disabled={isDemo}><Plus size={17}/> Add holding</button></div>

    <section className="surface invest-hero">
      <div className="invest-hero-main">
        <span className="eyebrow">TOTAL VALUE</span>
        <strong className="invest-total">{rp(pf.total, hidden)}</strong>
        <div className="invest-sub">
          <span className={`delta ${tone(pf.pl)}`}>{signed(pf.pl, hidden)} ({pct(pf.plPct)})</span><span>unrealised vs cost {rp(pf.cost, hidden)}</span>
        </div>
        <div className="invest-sub"><span className={`delta ${tone(pf.dayChange)}`}>{signed(pf.dayChange, hidden)} ({pct(pf.dayPct)})</span><span>last trading day</span></div>
      </div>
      <div className="invest-hero-side">
        <button className="btn btn-soft btn-small" onClick={refresh} disabled={busy || isDemo}><RefreshCw size={14} className={busy ? 'spinning' : ''}/> {busy ? 'Updating…' : 'Refresh prices'}</button>
        <small>Prices as of {when(pf.updated)}</small>
        {pf.fx > 0 && <small>USD/IDR {num(pf.fx, 0)}</small>}
        {msg && <small className="invest-msg">{msg}</small>}
      </div>
      {pf.stale > 0 && <p className="field-help invest-warn"><AlertTriangle size={15}/> {pf.stale} holding{pf.stale > 1 ? 's have' : ' has'} no market price yet — valued at cost. Tap Refresh prices.</p>}
    </section>

    {!holdings.length ? <section className="surface empty-invest"><TrendingUp size={28}/><h3>No holdings yet</h3><p>Add what you own in Stockbit, Bibit, Gotrade and GORO. Prices fill in automatically.</p><button className="btn btn-primary" onClick={onNew} disabled={isDemo}><Plus size={16}/> Add first holding</button></section> : <>
      <section className="surface">
        <div className="panel-heading"><div><span className="eyebrow">ALLOCATION</span><h3>Where your money sits</h3></div>
          <div className="segmented" role="group" aria-label="Group by">{[['platform', 'Platform'], ['type', 'Asset type']].map(([v, l]) => <button type="button" key={v} className={view === v ? 'selected' : ''} onClick={() => setView(v)}>{l}</button>)}</div></div>
        <div className="alloc-bar" aria-hidden="true">{groups.map((g, i) => <span key={g.key} style={{ width: `${g.share * 100}%`, background: colorFor(g.key, i) }}/>)}</div>
        <div className="alloc-list">{groups.map((g, i) => <div key={g.key} className="alloc-row">
          <span className="asset-dot" style={{ background: colorFor(g.key, i) }}/><span className="alloc-name">{g.key}</span>
          <span className="alloc-share">{(g.share * 100).toFixed(1)}%</span><strong>{rp(g.value, hidden)}</strong>
          <span className={`delta ${tone(g.pl)}`}>{pct(g.plPct)}</span></div>)}</div>
      </section>

      <section className="surface">
        <div className="panel-heading"><div><span className="eyebrow">GROWTH</span><h3>Portfolio value vs money put in</h3></div></div>
        {series.length >= 2 ? <div className="asset-chart">{hidden ? <div className="masked-graph"><EyeOff size={24}/><span>Chart hidden</span></div> :
          <ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 10, right: 8, left: -6, bottom: 0 }}>
            <CartesianGrid stroke="#f3eed7" strokeDasharray="3 5" vertical={false}/>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#94a3ab', fontSize: 11 }} minTickGap={18}/>
            <YAxis tickLine={false} axisLine={false} width={54} tick={{ fill: '#94a3ab', fontSize: 11 }} tickFormatter={v => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)}/>
            <Tooltip formatter={(v, n) => [idr.format(v), n]} labelStyle={{ color: '#22343c' }}/>
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }}/>
            <Line type="monotone" dataKey="value" name="Market value" stroke="#db6132" strokeWidth={2.5} dot={false}/>
            <Line type="monotone" dataKey="cost" name="Cost" stroke="#6fb4aa" strokeWidth={2} strokeDasharray="5 4" dot={false}/>
          </LineChart></ResponsiveContainer>}</div>
          : <p className="tiny-note">The chart builds up automatically — one point per day after each price update.</p>}
      </section>

      {pf.byPlatform.map((g, gi) => <section key={g.key} className="surface holdings-section">
        <div className="panel-heading"><div><span className="eyebrow" style={{ color: colorFor(g.key, gi) }}>{g.key.toUpperCase()}</span><h3>{rp(g.value, hidden)} <span className={`delta ${tone(g.pl)}`}>{signed(g.pl, hidden)} · {pct(g.plPct)}</span></h3></div></div>
        <div className="holdings-list">{g.items.sort((a, b) => b.value - a.value).map(h => <button key={h.id} className="holding-row" onClick={() => onEdit(h)}>
          <span className="holding-main"><strong>{h.symbol || h.name || typeLabel(h.asset_type)}{h.pocket ? <em className="pocket-tag">{h.pocket}</em> : null}</strong>
            <small>{h.asset_type === 'stock_idx' ? `${num(h.lots, 0)} lot · avg ${num(h.avg_cost, 0)}`
              : h.asset_type === 'fund' ? `${num(h.quantity, 4)} unit · avg NAV ${num(h.avg_cost, 2)}`
              : h.asset_type === 'stock_us' ? `${num(h.quantity, 6)} share · avg $${num(h.avg_cost, 2)}`
              : [typeLabel(h.asset_type), h.note].filter(Boolean).join(' · ')}</small></span>
          <span className="holding-price">{h.price != null ? <>{h.currency === 'USD' ? `$${num(h.price, 2)}` : num(h.price, h.asset_type === 'fund' ? 4 : 0)}<small className={`chg ${tone(h.dayChange)}`}>{h.dayChange ? pct(h.dayChange / (h.value - h.dayChange)) : '—'}</small></> : <small>{isMarket(h) ? 'no price yet' : 'manual'}</small>}</span>
          <span className="holding-value"><strong>{rp(h.value, hidden)}</strong><small className={`chg ${tone(h.pl)}`}>{signed(h.pl, hidden)} ({pct(h.plPct)})</small></span>
          <Pencil size={14} className="holding-edit"/>
        </button>)}</div>
      </section>)}
    </>}
    <button className="btn btn-soft full mobile-only-add" onClick={onNew} disabled={isDemo}><Plus size={17}/> Add holding</button>
  </div>;
}

export function HoldingSheet({ Sheet, existing, onClose, onSave, onDelete, searchFund }) {
  const e = existing || {};
  const [platform, setPlatform] = useState(INVEST_PLATFORMS.includes(e.platform) ? e.platform : 'Stockbit');
  const [pocket, setPocket] = useState(e.pocket || '');
  const [type, setType] = useState(e.asset_type || 'stock_idx');
  const [symbol, setSymbol] = useState(e.symbol || '');
  const [name, setName] = useState(e.name || '');
  const [fund, setFund] = useState(e.fund_id ? { id: e.fund_id, name: e.name } : null);
  const [qty, setQty] = useState(e.quantity != null ? String(e.asset_type === 'stock_idx' ? Number(e.quantity) / 100 : Number(e.quantity)) : '');
  const [avg, setAvg] = useState(e.avg_cost != null ? String(Number(e.avg_cost)) : '');
  const [value, setValue] = useState(e.manual_value != null ? String(Number(e.manual_value)) : '');
  const [cost, setCost] = useState(e.manual_cost != null ? String(Number(e.manual_cost)) : '');
  const [note, setNote] = useState(e.note || '');
  const [term, setTerm] = useState(''), [results, setResults] = useState([]), [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const market = ['stock_idx', 'stock_us', 'fund'].includes(type);
  useEffect(() => { if (platform === 'Bibit' && !existing) setType('fund'); if (platform === 'Gotrade' && !existing) setType('stock_us'); if (platform === 'GORO' && !existing) setType('property'); if (platform === 'Stockbit' && !existing) setType('stock_idx'); }, [platform]);
  async function find(ev) { ev?.preventDefault(); if (term.trim().length < 3) return; setSearching(true); setError(''); try { setResults(await searchFund(term.trim())); } catch (err) { setError(err.message || 'Search failed.'); } finally { setSearching(false); } }
  async function submit(ev) {
    ev.preventDefault(); setError('');
    if (type === 'fund' && !fund) { setError('Search and pick the mutual fund first.'); return; }
    if ((type === 'stock_idx' || type === 'stock_us') && !symbol.trim()) { setError('Enter the ticker code.'); return; }
    const payload = {
      platform, pocket: pocket.trim().toUpperCase(), asset_type: type, symbol: market && type !== 'fund' ? symbol.trim().toUpperCase() : symbol.trim(),
      name: type === 'fund' ? fund.name : name.trim(), fund_id: type === 'fund' ? fund.id : null,
      quantity: market ? Number(qty || 0) * (type === 'stock_idx' ? 100 : 1) : 0, avg_cost: market ? Number(avg || 0) : 0,
      currency: type === 'stock_us' ? 'USD' : 'IDR',
      manual_value: market ? null : Number(value || 0), manual_cost: market ? null : (cost === '' ? null : Number(cost)), note: note.trim(),
    };
    setSaving(true); try { await onSave(payload, existing); onClose(); } catch (err) { setError(err.message || 'Could not save.'); } finally { setSaving(false); }
  }
  async function remove() { if (!window.confirm(`Delete ${existing.symbol || existing.name}?`)) return; try { await onDelete(existing); onClose(); } catch (err) { setError(err.message || 'Could not delete.'); } }

  return <Sheet title={existing ? 'Edit holding' : 'Add holding'} onClose={onClose}><form className="form sheet-form" onSubmit={submit}>
    <div className="form-pair">
      <label>Platform<select value={platform} onChange={ev => setPlatform(ev.target.value)}>{INVEST_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
      <label>Type<select value={type} onChange={ev => setType(ev.target.value)}>{ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
    </div>
    <label>Portfolio inside the platform <span className="optional">(optional, e.g. RDPU, RUMAH)</span><input value={pocket} onChange={ev => setPocket(ev.target.value)} maxLength={40} placeholder="Leave empty if not split"/></label>
    {(type === 'stock_idx' || type === 'stock_us') && <label>Ticker<input required value={symbol} onChange={ev => setSymbol(ev.target.value.toUpperCase())} placeholder={type === 'stock_idx' ? 'e.g. BBCA' : 'e.g. VOO'} maxLength={12} autoCapitalize="characters"/></label>}
    {type === 'fund' && <div className="fund-picker">
      {fund ? <div className="fund-chosen"><span><strong>{fund.name}</strong>{fund.nav ? <small>NAV {num(fund.nav, 4)} · {fund.category}</small> : null}</span><button type="button" className="btn btn-outline btn-small" onClick={() => { setFund(null); setResults([]); }}>Change</button></div> : <>
        <label>Mutual fund<div className="fund-search"><input value={term} onChange={ev => setTerm(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter') find(ev); }} placeholder="e.g. Sucorinvest Money Market"/><button type="button" className="btn btn-soft" onClick={find} disabled={searching || term.trim().length < 3}><Search size={15}/> {searching ? '…' : 'Search'}</button></div></label>
        {results.length > 0 && <div className="fund-results">{results.map(r => <button type="button" key={r.id} onClick={() => { setFund(r); setResults([]); }}><strong>{r.name}</strong><small>{r.category} · NAV {num(r.nav, 4)}</small></button>)}</div>}
        {!searching && term.length >= 3 && results.length === 0 && <p className="tiny-note">Type part of the name exactly as in Bibit, then Search.</p>}
      </>}
    </div>}
    {market ? <div className="form-pair">
      <label>{type === 'stock_idx' ? 'Lots (1 lot = 100 shares)' : type === 'fund' ? 'Units' : 'Shares'}<input required type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={ev => setQty(ev.target.value)}/></label>
      <label>Average price {type === 'stock_us' ? '(USD)' : type === 'fund' ? '(NAV, Rp)' : '(Rp/share)'}<input required type="number" inputMode="decimal" min="0" step="any" value={avg} onChange={ev => setAvg(ev.target.value)}/></label>
    </div> : <>
      <label>Name<input value={name} onChange={ev => setName(ev.target.value)} placeholder={type === 'bond' ? 'e.g. ST017-T2' : type === 'property' ? 'e.g. Villa Bali' : 'e.g. RDN cash'} maxLength={160}/></label>
      <div className="form-pair">
        <label>Current value (Rp)<input required type="number" inputMode="numeric" min="0" step="1" value={value} onChange={ev => setValue(ev.target.value)}/></label>
        <label>Amount invested (Rp) <span className="optional">optional</span><input type="number" inputMode="numeric" min="0" step="1" value={cost} onChange={ev => setCost(ev.target.value)}/></label>
      </div>
      <p className="field-help">No live price for this type — update the value when you check the platform.</p>
    </>}
    <label>Note <span className="optional">optional</span><input value={note} onChange={ev => setNote(ev.target.value)} maxLength={300}/></label>
    {error && <div className="feedback error" role="alert">{error}</div>}
    <button className="btn btn-primary full" disabled={saving}>{saving ? 'Saving…' : 'Save holding'}<Check size={17}/></button>
    {existing && <button type="button" className="btn btn-outline full" onClick={remove}><Trash2 size={16}/> Delete this holding</button>}
  </form></Sheet>;
}
