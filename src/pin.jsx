import React, { useCallback, useEffect, useState } from 'react';
import { LockKeyhole, ShieldCheck, Delete } from 'lucide-react';

// PIN aplikasi 6 digit, disimpan per perangkat (hash SHA-256 + salt di localStorage).
// PIN tidak pernah dikirim ke server. Lupa PIN → keluar akun, PIN dihapus, login ulang.
export const PIN_LENGTH = 6;
const LOCK_AFTER_MS = 60 * 1000;      // kunci lagi setelah app ditinggal 1 menit
const MAX_ATTEMPTS = 5;
const keyFor = uid => `ff-pin-${uid}`;

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function readPin(uid) { try { return JSON.parse(localStorage.getItem(keyFor(uid)) || 'null'); } catch { return null; } }
export function hasPin(uid) { return !!readPin(uid)?.hash; }
export async function savePin(uid, pin) {
  const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(keyFor(uid), JSON.stringify({ salt, hash: await hashPin(pin, salt), fails: 0 }));
}
export function clearPin(uid) { try { localStorage.removeItem(keyFor(uid)); } catch { /* ignore */ } }
export async function checkPin(uid, pin) {
  const p = readPin(uid); if (!p) return { ok: true };
  const ok = (await hashPin(pin, p.salt)) === p.hash;
  const fails = ok ? 0 : (p.fails || 0) + 1;
  localStorage.setItem(keyFor(uid), JSON.stringify({ ...p, fails }));
  return { ok, left: MAX_ATTEMPTS - fails };
}

// Status terkunci + kunci ulang saat app kembali dibuka setelah > 1 menit.
export function usePinLock(uid) {
  const [locked, setLocked] = useState(() => !!uid && hasPin(uid));
  useEffect(() => { setLocked(!!uid && hasPin(uid)); }, [uid]);
  useEffect(() => {
    if (!uid) return;
    let hiddenAt = null;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > LOCK_AFTER_MS && hasPin(uid)) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [uid]);
  return { locked, unlock: useCallback(() => setLocked(false), []), lock: useCallback(() => setLocked(true), []) };
}

function PinPad({ value, onChange, onDone, disabled }) {
  useEffect(() => {
    const onKey = e => {
      if (disabled) return;
      if (/^\d$/.test(e.key) && value.length < PIN_LENGTH) onChange(value + e.key);
      else if (e.key === 'Backspace') onChange(value.slice(0, -1));
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [value, onChange, disabled]);
  useEffect(() => { if (value.length === PIN_LENGTH) onDone(value); }, [value]); // eslint-disable-line
  const press = d => { if (!disabled && value.length < PIN_LENGTH) onChange(value + d); };
  return <div className="pin-pad">
    <div className="pin-dots" aria-label={`${value.length} of ${PIN_LENGTH} digits entered`}>{Array.from({ length: PIN_LENGTH }, (_, i) => <span key={i} className={i < value.length ? 'filled' : ''}/>)}</div>
    <div className="pin-keys">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button type="button" key={d} onClick={() => press(d)} disabled={disabled}>{d}</button>)}
      <span/>
      <button type="button" onClick={() => press('0')} disabled={disabled}>0</button>
      <button type="button" aria-label="Delete digit" onClick={() => onChange(value.slice(0, -1))} disabled={disabled}><Delete size={22}/></button>
    </div>
  </div>;
}

export function PinLockScreen({ uid, name, onUnlock, onForgot }) {
  const [pin, setPin] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [shake, setShake] = useState(false);
  async function done(v) {
    setBusy(true);
    const r = await checkPin(uid, v);
    setBusy(false);
    if (r.ok) { onUnlock(); return; }
    setPin(''); setShake(true); setTimeout(() => setShake(false), 400);
    if (r.left <= 0) { setMsg('Too many wrong attempts — signing out.'); clearPin(uid); setTimeout(onForgot, 900); }
    else setMsg(`Wrong PIN. ${r.left} attempt${r.left > 1 ? 's' : ''} left.`);
  }
  return <div className="pin-screen" role="dialog" aria-modal="true" aria-label="Enter PIN">
    <div className={`pin-card ${shake ? 'shake' : ''}`}>
      <div className="pin-icon"><LockKeyhole size={26}/></div>
      <h2>Welcome back{name ? `, ${name}` : ''}</h2>
      <p>Enter your 6-digit PIN</p>
      <PinPad value={pin} onChange={v => { setMsg(''); setPin(v); }} onDone={done} disabled={busy}/>
      <p className={`pin-msg ${msg ? 'show' : ''}`} role="alert">{msg || ' '}</p>
      <button type="button" className="link-button" onClick={() => { if (window.confirm('Forgot your PIN? You will be signed out and the PIN on this device will be removed. Sign in again to set a new one.')) { clearPin(uid); onForgot(); } }}>Forgot PIN?</button>
    </div>
  </div>;
}

// Kartu pengaturan PIN di halaman Family.
export function PinCard({ uid, isDemo }) {
  const [on, setOn] = useState(() => !!uid && hasPin(uid));
  const [mode, setMode] = useState(null); // 'verify' | 'set' | 'confirm' | 'off'
  const [pin, setPin] = useState(''), [first, setFirst] = useState(''), [msg, setMsg] = useState('');
  const reset = () => { setMode(null); setPin(''); setFirst(''); };
  async function done(v) {
    if (mode === 'verify') {
      const r = await checkPin(uid, v);
      if (!r.ok) { setPin(''); setMsg(`Wrong PIN. ${Math.max(r.left, 0)} attempt(s) left.`); return; }
      setPin(''); setMode('set'); return;
    }
    if (mode === 'set') { setFirst(v); setPin(''); setMode('confirm'); setMsg(''); return; }
    if (mode === 'confirm') {
      if (v !== first) { setMsg('PINs did not match. Start again.'); setFirst(''); setPin(''); setMode('set'); return; }
      await savePin(uid, v); setOn(true); setMsg('PIN is on for this device.'); reset(); return;
    }
    if (mode === 'off') {
      const r = await checkPin(uid, v);
      if (!r.ok) { setPin(''); setMsg(`Wrong PIN. ${Math.max(r.left, 0)} attempt(s) left.`); return; }
      clearPin(uid); setOn(false); setMsg('PIN turned off on this device.'); reset();
    }
  }
  return <section className="surface family-box">
    <div className="family-card-icon"><ShieldCheck size={23}/></div>
    <h3>App PIN</h3>
    <p className="muted">A 6-digit PIN locks the app when it opens and after 1 minute in the background. It's saved only on this device — set one on each phone.</p>
    <div className="privacy-row"><span><LockKeyhole size={18}/></span><div><strong>Status</strong><p>{isDemo ? 'Not available in demo mode.' : on ? 'On for this device' : 'Off'}</p></div></div>
    {mode ? <div className="pin-inline">
      <p className="pin-inline-title">{mode === 'set' ? 'Choose a new 6-digit PIN' : mode === 'confirm' ? 'Enter the same PIN again' : 'Enter your current PIN'}</p>
      <PinPad value={pin} onChange={v => { setMsg(''); setPin(v); }} onDone={done}/>
      <button type="button" className="btn btn-outline full" onClick={() => { reset(); setMsg(''); }}>Cancel</button>
    </div> : <div className="button-row">
      {!on ? <button className="btn btn-primary" disabled={isDemo} onClick={() => { setMsg(''); setMode('set'); }}><LockKeyhole size={16}/> Set PIN</button>
        : <><button className="btn btn-outline" onClick={() => { setMsg(''); setMode('verify'); }}>Change PIN</button><button className="btn btn-outline" onClick={() => { setMsg(''); setMode('off'); }}>Turn off</button></>}
    </div>}
    {msg && <p className="tiny-note" role="status">{msg}</p>}
  </section>;
}
