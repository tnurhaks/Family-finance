import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, configured } from './supabase';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Check,
  CheckCircle2, ChevronDown, CircleHelp, Cloud,
  CloudOff, Copy, CreditCard, Eye, EyeOff, Home, LockKeyhole,
  LogOut, MoreHorizontal, Pencil, Plus, ReceiptText, RefreshCw,
  Search, Settings2, ShieldCheck, Sparkles, Trash2, TrendingDown, TrendingUp,
  Users, Wallet, WifiOff, X, PiggyBank, Target, Mail, Inbox, KeyRound, ArrowLeftRight
} from 'lucide-react';
import { TAXONOMY, EXPENSE_GROUPS, INTERNAL_INCOME, isRealIncome, isSpending, isSaving, iconFor, labelFor } from './categories';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell
} from 'recharts';
import './style.css';

const PALETTE = ['#f2643c', '#7b5ea7', '#f7a541', '#e0457b', '#ff9f7a', '#b07cc6', '#ffcb6b', '#a89ba8'];
const sum = (list, fn = x => x) => list.reduce((s, x) => s + Number(fn(x) || 0), 0);
const currency = new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0, maximumFractionDigits:2 });
const number = n => currency.format(Number(n) || 0);
const compact = n => new Intl.NumberFormat('id-ID',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
const dateToday = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const monthNow = () => dateToday().slice(0,7);
const monthLabel = s => new Date(`${s}-01T12:00:00`).toLocaleDateString('id-ID',{month:'long',year:'numeric'});
const dateLabel = s => new Date(`${s}T12:00:00`).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
const shortMonth = s => new Date(`${s}-01T12:00:00`).toLocaleDateString('id-ID',{month:'short'});
const shiftMonth = (s, offset) => { const [y,m] = s.split('-').map(Number); const d=new Date(y,m-1+offset,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
// Efek satu transaksi ke saldo satu rekening (transfer: keluar dari sumber, masuk ke tujuan).
const txDelta = (t, accountId) => (t.account_id===accountId ? (t.kind==='income'?1:-1)*Number(t.amount) : 0) + (t.kind==='transfer'&&t.to_account_id===accountId ? Number(t.amount) : 0);
const getBalance = (account, txs) => Number(account.opening_balance) + txs.reduce((n,t)=>n+txDelta(t,account.id),0);
const formatValue = (value, hidden) => hidden ? 'Rp •••••••' : number(value);
const scopeText = {all:'Semua akses',shared:'Bersama',private:'Pribadi saya'};
const navItems = [{id:'dashboard',label:'Beranda',Icon:Home},{id:'transactions',label:'Transaksi',Icon:ReceiptText},{id:'budget',label:'Budget',Icon:Target},{id:'accounts',label:'Rekening',Icon:Wallet},{id:'family',label:'Keluarga',Icon:Users}];
const BOTTOM_NAV = ['dashboard','transactions','budget','accounts'];

function Brand({compactMode=false}) {
  return <div className="brand"><span className="brand-icon"><Wallet size={21} strokeWidth={2.4}/></span>{!compactMode&&<span>family<span className="brand-accent">finance.</span></span>}</div>;
}
function Avatar({name='Pengguna'}) { return <div className="avatar" aria-label={`Akun ${name}`}>{name.trim().slice(0,1).toUpperCase()}</div>; }
function IconButton({label,onClick,children,className='',disabled=false}) {return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>}
function Notice({notice,onClose}) { return notice ? <div className={`toast ${notice.type==='error'?'toast-error':''}`} role="status"><span className="toast-symbol">{notice.type==='error'?<CircleHelp size={18}/>:<CheckCircle2 size={18}/>}</span><span>{notice.message}</span><IconButton label="Tutup pesan" onClick={onClose}><X size={17}/></IconButton></div> : null; }
function WelcomeBadge({name}) {return <span className="welcome-badge"><Sparkles size={14}/> {name}</span>}
function EmptyState({icon:Icon=ReceiptText,title,description,action,onAction}) {return <div className="empty-state"><div className="empty-illustration"><Icon size={29}/></div><h3>{title}</h3><p>{description}</p>{action&&<button className="btn btn-soft" onClick={onAction}><Plus size={16}/>{action}</button>}</div>}
function Segmented({value,onChange,options,label}) {return <div className="segmented" role="group" aria-label={label}>{options.map(x=><button type="button" key={x.value} className={value===x.value?'selected':''} onClick={()=>onChange(x.value)} aria-pressed={value===x.value}>{x.label}</button>)}</div>}

function Auth({onDemo}) {
  const [register,setRegister] = useState(false), [name,setName]=useState(''), [email,setEmail]=useState(''), [password,setPassword]=useState(''), [busy,setBusy]=useState(false), [message,setMessage]=useState(''), [error,setError]=useState('');
  async function submit(e) {
    e.preventDefault();setBusy(true);setMessage('');setError('');
    try {
      const response=register ? await supabase.auth.signUp({email,password,options:{data:{display_name:name.trim()}}}) : await supabase.auth.signInWithPassword({email,password});
      if(response.error)throw response.error;
      if(register)setMessage('Pendaftaran berhasil. Periksa email untuk konfirmasi akun, lalu masuk.');
    } catch(err){setError(err.message||'Tidak berhasil menghubungkan akun. Coba lagi.')} finally{setBusy(false)}
  }
  return <div className="auth-page"><div className="auth-visual"><Brand/><div className="auth-story"><div className="eyebrow light"><Sparkles size={16}/> Uang yang dikelola bersama</div><h1>Satu keluarga.<br/><em>Satu tujuan.</em></h1><p>Lebih mudah merencanakan masa depan ketika semua tercatat dengan jelas, tanpa kehilangan privasi pribadi.</p><div className="auth-feature"><span><Check size={15}/> Rekening bersama & pribadi</span><span><Check size={15}/> Sinkron otomatis</span><span><Check size={15}/> Dashboard real-time</span></div></div><div className="auth-visual-footer">Dibuat untuk perjalanan finansial kalian berdua. ♡</div></div><main className="auth-main"><div className="auth-mobile-brand"><Brand/></div><div className="auth-card"><WelcomeBadge name="Selamat datang"/><h2>{register?'Mulai cerita finansial kalian.':'Halo, selamat datang kembali.'}</h2><p className="muted">{register?'Buat akun pribadi terlebih dahulu. Pasanganmu akan memiliki akun terpisah.':'Masuk untuk melihat perjalanan keuangan keluarga.'}</p><form onSubmit={submit} className="form">{register&&<label>Nama panggilan<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Nama kamu" autoComplete="name"/></label>}<label>Alamat email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email"/></label><label>Kata sandi<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 6 karakter" autoComplete={register?'new-password':'current-password'}/></label>{error&&<div className="feedback error" role="alert">{error}</div>}{message&&<div className="feedback success" role="status">{message}</div>}<button className="btn btn-primary full" disabled={busy}>{busy?'Memproses...':register?'Buat akun':'Masuk ke Family Finance'}<ArrowRight size={17}/></button></form><div className="auth-switch">{register?'Sudah punya akun?':'Belum punya akun?'} <button className="link-button" onClick={()=>{setRegister(!register);setError('');setMessage('')}}>{register?'Masuk':'Daftar sekarang'}</button></div><div className="auth-divider"><span>atau</span></div><button className="btn btn-outline full" onClick={onDemo}><Eye size={17}/> Lihat tampilan demo</button><p className="auth-footnote"><ShieldCheck size={15}/> Rekening pribadi hanya dapat diakses pemiliknya.</p></div></main></div>;
}

function Setup({onDone}) {
  const [tab,setTab]=useState('create'),[name,setName]=useState('Keluarga Kita'),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{const {error:e}=await supabase.rpc(tab==='create'?'create_household':'join_household',tab==='create'?{p_name:name.trim()}:{p_invite_code:code.trim()});if(e)throw e;onDone()}catch(e){setError(e.message||'Tidak berhasil. Coba kembali.')}finally{setBusy(false)}};
  return <div className="onboard-page"><div className="onboard-card"><Brand/><WelcomeBadge name="Langkah pertama"/><h1>Ruang kecil untuk mimpi besar.</h1><p className="muted">Buat ruang keluarga lalu undang pasangan menggunakan kode pribadi. Maksimal dua anggota untuk versi ini.</p><Segmented label="Bergabung ke keluarga" value={tab} onChange={v=>{setTab(v);setError('')}} options={[{value:'create',label:'Buat keluarga'},{value:'join',label:'Gabung keluarga'}]}/><form className="form" onSubmit={submit}>{tab==='create'?<label>Nama keluarga<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>:<label>Kode undangan<input required value={code} onChange={e=>setCode(e.target.value)} placeholder="Tempel kode dari pasangan"/></label>}{error&&<div className="feedback error" role="alert">{error}</div>}<button className="btn btn-primary full" disabled={busy}>{busy?'Memproses...':tab==='create'?'Buat ruang keluarga':'Gabung keluarga'}<ArrowRight size={18}/></button></form><button className="link-button signout" onClick={()=>supabase.auth.signOut()}>Keluar dari akun</button></div></div>;
}

function Sheet({title,onClose,children}) {
  useEffect(()=>{const old=document.body.style.overflow;document.body.style.overflow='hidden';const key=e=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',key)}},[onClose]);
  return <div className="sheet-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="sheet" role="dialog" aria-modal="true" aria-label={title}><div className="sheet-handle"/><div className="sheet-heading"><div><span className="eyebrow">CATAT KEUANGAN</span><h2>{title}</h2></div><IconButton label="Tutup formulir" onClick={onClose}><X size={20}/></IconButton></div>{children}</section></div>;
}
function AccountSheet({existing,onClose,onSave}) {
  const [name,setName]=useState(existing?.name||''),[visibility,setVisibility]=useState(existing?.visibility||'shared'),[opening,setOpening]=useState(String(existing?.opening_balance??'0')),[saving,setSaving]=useState(false),[error,setError]=useState('');
  async function submit(e){e.preventDefault();setError('');setSaving(true);try{await onSave({name:name.trim(),visibility,opening_balance:Number(opening)},existing);onClose()}catch(err){setError(err.message||'Gagal menyimpan rekening.')}finally{setSaving(false)}}
  return <Sheet title={existing?'Edit rekening':'Rekening baru'} onClose={onClose}><form className="form sheet-form" onSubmit={submit}><label>Nama rekening<input autoFocus required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Contoh: BCA Bersama"/></label><div><div className="field-label">Siapa yang bisa melihat?</div><div className="visibility-choices"><button type="button" className={visibility==='shared'?'chosen':''} onClick={()=>setVisibility('shared')}><Users size={18}/><strong>Bersama</strong><small>Keduanya dapat melihat</small></button><button type="button" className={visibility==='private'?'chosen':''} onClick={()=>setVisibility('private')}><LockKeyhole size={18}/><strong>Pribadi</strong><small>Hanya akun kamu</small></button></div></div><label>Saldo awal (Rp)<input type="number" inputMode="decimal" step="0.01" required value={opening} onChange={e=>setOpening(e.target.value)}/></label><p className="field-help"><ShieldCheck size={15}/> Rekening pribadi dan transaksinya tetap privat.</p>{error&&<div className="feedback error" role="alert">{error}</div>}<button className="btn btn-primary full" disabled={saving||!name.trim()}>{saving?'Menyimpan...':'Simpan rekening'}<Check size={17}/></button></form></Sheet>;
}
// existing = transaksi yang diedit; draft = usulan dari email Gmail (belum tersimpan).
function TransactionSheet({existing,draft,accounts,onClose,onSave}) {
  const init=existing||draft||{};
  const guessAccount=draft?.account_hint?accounts.find(a=>a.name.trim().toUpperCase()===draft.account_hint.trim().toUpperCase())?.id:undefined;
  const firstGroup=EXPENSE_GROUPS.includes(init.category)?init.category:'Kebutuhan';
  const [kind,setKind]=useState(init.kind||'expense'),[accountId,setAccountId]=useState(existing?.account_id||guessAccount||accounts[0]?.id||''),[toAccountId,setToAccountId]=useState(init.to_account_id||''),[amount,setAmount]=useState(String(init.amount??'')),[group,setGroup]=useState(firstGroup),[sub,setSub]=useState(init.subcategory||(init.kind==='income'?'Gaji':'Makan')),[note,setNote]=useState(init.note||draft?.merchant||''),[date,setDate]=useState(init.occurred_on||dateToday()),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const subs=kind==='income'?TAXONOMY.Pemasukan:TAXONOMY[group]||[];
  const account=accounts.find(a=>a.id===accountId);
  const switchKind=v=>{setKind(v);setSub(v==='income'?'Gaji':v==='expense'?TAXONOMY[group][0]:'')};
  const switchGroup=g=>{setGroup(g);setSub(TAXONOMY[g][0])};
  async function submit(e){e.preventDefault();setSaving(true);setError('');try{await onSave({kind,account_id:accountId,amount:Number(amount),category:kind==='transfer'?'Transfer':kind==='income'?'Pemasukan':group,subcategory:kind==='transfer'?'':sub.trim(),to_account_id:kind==='transfer'&&toAccountId?toAccountId:null,note:note.trim(),occurred_on:date},existing);onClose()}catch(err){setError(err.message||'Gagal menyimpan transaksi.')}finally{setSaving(false)}}
  return <Sheet title={existing?'Edit transaksi':draft?'Review dari Gmail':'Transaksi baru'} onClose={onClose}><form className="form sheet-form" onSubmit={submit}>
    {draft&&<div className="context-note gmail-note"><Mail size={16}/><span><strong>{draft.subject||draft.sender}</strong>{draft.reason?` — ${draft.reason}`:''}</span></div>}
    <Segmented label="Jenis transaksi" value={kind} onChange={switchKind} options={[{value:'expense',label:'↗ Keluar'},{value:'income',label:'↙ Masuk'},{value:'transfer',label:'⇄ Transfer'}]}/>
    <label>Nominal transaksi (Rp)<div className="amount-input-wrap"><span>Rp</span><input autoFocus aria-label="Nominal transaksi dalam rupiah" type="number" inputMode="decimal" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></div></label>
    {kind==='expense'&&<div><div className="field-label">Kategori</div><Segmented label="Kategori Budggt" value={group} onChange={switchGroup} options={EXPENSE_GROUPS.map(g=>({value:g,label:g}))}/></div>}
    <div className="form-pair">{kind!=='transfer'?<label>Sub kategori<input required list="sub-options" value={sub} onChange={e=>setSub(e.target.value)} maxLength={80}/><datalist id="sub-options">{subs.map(c=><option key={c} value={c}/>)}</datalist></label>:<label>Ke rekening<select value={toAccountId} onChange={e=>setToAccountId(e.target.value)}><option value="">Di luar aplikasi / ke pasangan</option>{accounts.filter(a=>a.id!==accountId).map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>}<label>Tanggal<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label></div>
    <label>{kind==='income'?'Masuk ke rekening':'Dari rekening'}<select required value={accountId} onChange={e=>setAccountId(e.target.value)}>{accounts.map(a=><option value={a.id} key={a.id}>{a.name} · {a.visibility==='shared'?'Bersama':'Pribadi'}</option>)}</select></label>
    {kind==='transfer'&&<div className="context-note"><ArrowLeftRight size={16}/> Transfer tidak dihitung sebagai pengeluaran — hanya memindahkan saldo. Termasuk bayar kartu kredit.</div>}
    {kind!=='transfer'&&account&&<div className="context-note">{account.visibility==='shared'?<Users size={16}/>:<LockKeyhole size={16}/>} {account.visibility==='shared'?'Transaksi ini terlihat oleh pasangan.':'Detail hanya terlihat olehmu.'}</div>}
    <label>Catatan <span className="optional">(opsional)</span><input maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="Contoh: Bakmi Jogja Mas Goen"/></label>
    {error&&<div className="feedback error" role="alert">{error}</div>}
    <button className="btn btn-primary full" disabled={saving||!accountId||!Number.isFinite(Number(amount))||Number(amount)<=0||(kind!=='transfer'&&!sub.trim())}>{saving?'Menyimpan...':draft?'Setujui & simpan':'Simpan transaksi'}<Check size={17}/></button></form></Sheet>;
}
function BudgetSheet({existing,year,onClose,onSave,onDelete}) {
  const [group,setGroup]=useState(existing?.category||'Kebutuhan'),[sub,setSub]=useState(existing?.subcategory??''),[amount,setAmount]=useState(String(existing?.monthly_amount??'')),[note,setNote]=useState(existing?.note||''),[saving,setSaving]=useState(false),[error,setError]=useState('');
  async function submit(e){e.preventDefault();setSaving(true);setError('');try{await onSave({year,category:group,subcategory:sub.trim(),monthly_amount:Number(amount),note:note.trim()},existing);onClose()}catch(err){setError(err.message||'Gagal menyimpan budget.')}finally{setSaving(false)}}
  async function remove(){if(!window.confirm('Hapus baris budget ini?'))return;try{await onDelete(existing);onClose()}catch(err){setError(err.message||'Gagal menghapus.')}}
  return <Sheet title={existing?'Edit budget':`Budget ${year}`} onClose={onClose}><form className="form sheet-form" onSubmit={submit}>
    {!existing&&<Segmented label="Kategori" value={group} onChange={g=>{setGroup(g);setSub('')}} options={EXPENSE_GROUPS.map(g=>({value:g,label:g}))}/>}
    {existing?<div className="context-note"><Target size={16}/> {existing.category}{existing.subcategory?` · ${existing.subcategory}`:' · seluruh kategori'}</div>:<label>Sub kategori <span className="optional">(kosongkan = seluruh {group})</span><input list="budget-sub" value={sub} onChange={e=>setSub(e.target.value)} maxLength={80}/><datalist id="budget-sub">{TAXONOMY[group].map(c=><option key={c} value={c}/>)}</datalist></label>}
    <label>Budget per bulan (Rp)<div className="amount-input-wrap"><span>Rp</span><input autoFocus type="number" inputMode="numeric" min="0" step="1000" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></div></label>
    <label>Catatan <span className="optional">(opsional)</span><input maxLength={300} value={note} onChange={e=>setNote(e.target.value)}/></label>
    {error&&<div className="feedback error" role="alert">{error}</div>}
    <button className="btn btn-primary full" disabled={saving||amount===''||Number(amount)<0}>{saving?'Menyimpan...':'Simpan budget'}<Check size={17}/></button>
    {existing&&<button type="button" className="btn btn-outline full" onClick={remove}><Trash2 size={16}/> Hapus baris ini</button>}
  </form></Sheet>;
}

function TransactionItem({tx,byId,userId,hidden,onEdit,onDelete}) {
  const account=byId[tx.account_id], to=tx.to_account_id?byId[tx.to_account_id]:null;
  const from=account?.name||'Rekening pribadi pasangan';
  const label=labelFor(tx);
  const sign=tx.kind==='income'?'+':tx.kind==='expense'?'−':'';
  const amountClass=tx.kind==='income'?'is-positive':tx.kind==='transfer'?'is-neutral':'';
  return <article className="transaction-item"><div className={`category-icon ${tx.kind==='income'?'category-income':tx.kind==='transfer'?'category-transfer':tx.category==='Tabungan'?'category-saving':''}`} aria-hidden="true">{iconFor(tx)}</div><div className="transaction-description"><strong>{label}{tx.kind==='expense'&&<span className="group-chip">{tx.category}</span>}</strong><span>{tx.note||(tx.kind==='transfer'?'Pindah saldo':tx.kind==='income'?'Pemasukan':tx.category)}</span><small>{dateLabel(tx.occurred_on)} <span className="middot">·</span> {account?.visibility==='shared'?<Users size={11}/>:<LockKeyhole size={11}/>} {tx.kind==='transfer'?`${from} → ${to?.name||'luar'}`:from}{tx.source==='gmail'&&<span className="source-chip"><Mail size={10}/> Gmail</span>}</small></div><div className="transaction-side"><strong className={amountClass}>{hidden?'••••••':`${sign}${number(tx.amount)}`}</strong>{tx.created_by===userId&&<div className="tx-actions"><IconButton label={`Edit transaksi ${label}`} onClick={()=>onEdit(tx)}><Pencil size={15}/></IconButton><IconButton label={`Hapus transaksi ${label}`} onClick={()=>onDelete(tx)}><Trash2 size={15}/></IconButton></div>}</div></article>;
}
function TransactionList({items,accounts,userId,hidden,onEdit,onDelete,emptyAction}) {
  const byId=Object.fromEntries(accounts.map(a=>[a.id,a]));
  if(!items.length)return <EmptyState title="Belum ada transaksi" description="Mulai dari transaksi kecil hari ini. Semuanya akan tercatat rapi di sini." action={emptyAction?'Catat transaksi':undefined} onAction={emptyAction}/>;
  return <div className="transaction-list">{items.map(t=><TransactionItem key={t.id} tx={t} byId={byId} userId={userId} hidden={hidden} onEdit={onEdit} onDelete={onDelete}/>)}</div>;
}
function InboxList({items,hidden,onApprove,onReject}) {
  if(!items.length)return <EmptyState icon={Inbox} title="Tidak ada yang perlu direview" description="Transaksi dari Gmail yang yakin kategorinya langsung tercatat otomatis. Yang ragu-ragu akan muncul di sini."/>;
  return <div className="transaction-list">{items.map(it=><article className="transaction-item inbox-item" key={it.id}><div className="category-icon category-inbox" aria-hidden="true"><Mail size={19}/></div><div className="transaction-description"><strong>{it.merchant||it.subject||it.sender}</strong><span>{it.subcategory?`Usulan: ${it.category} · ${it.subcategory}`:'Kategori belum diketahui'}{it.account_hint?` · ${it.account_hint}`:''}</span><small>{dateLabel(it.occurred_on)} <span className="middot">·</span> {it.reason||it.sender}</small></div><div className="transaction-side"><strong className={it.kind==='income'?'is-positive':''}>{it.amount==null?'Rp ?':hidden?'••••••':number(it.amount)}</strong><div className="inbox-actions"><button className="btn btn-soft btn-small" onClick={()=>onApprove(it)}><Check size={14}/> Review</button><IconButton label="Abaikan email ini" onClick={()=>onReject(it)}><X size={15}/></IconButton></div></div></article>)}</div>;
}
function InsightGraph({data,hidden}){
  return <section className="surface panel-graph"><div className="panel-heading"><div><span className="eyebrow">RINGKASAN</span><h3>Arus kas 6 bulan</h3></div><div className="graph-legend"><span><i className="dot dot-mint"/>Pemasukan</span><span><i className="dot dot-blue"/>Pengeluaran</span></div></div>{hidden?<div className="masked-graph"><EyeOff size={24}/><span>Grafik disembunyikan</span></div>:<div className="graph-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{top:14,right:0,left:-20,bottom:0}} barGap={6}><CartesianGrid stroke="#f1e7e4" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fill:'#85919d',fontSize:12}} dy={9}/><YAxis tickLine={false} axisLine={false} tick={{fill:'#98a4ae',fontSize:11}} tickFormatter={compact}/><Tooltip formatter={number} contentStyle={{borderRadius:14,border:'1px solid #e9edf0',boxShadow:'0 14px 30px #3a184620'}}/><Bar dataKey="pemasukan" name="Pemasukan" fill="#f59e42" radius={[6,6,0,0]} maxBarSize={30}/><Bar dataKey="pengeluaran" name="Pengeluaran" fill="#7b5ea7" radius={[6,6,0,0]} maxBarSize={30}/></BarChart></ResponsiveContainer></div>}</section>;
}
function CategoryGraph({data,expense,hidden}) {
  return <section className="surface panel-categories"><div className="panel-heading"><div><span className="eyebrow">PENGELUARAN</span><h3>Ke mana uang pergi?</h3></div></div>{!data.length?<EmptyState icon={BarChart3} title="Belum ada pengeluaran" description="Kategori akan muncul setelah ada transaksi pengeluaran."/>:hidden?<div className="masked-graph"><EyeOff size={24}/><span>Rincian disembunyikan</span></div>:<><div className="donut-area"><ResponsiveContainer width="100%" height={204}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={66} outerRadius={89} paddingAngle={3} stroke="none">{data.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Pie><Tooltip formatter={number}/></PieChart></ResponsiveContainer><div className="donut-center"><span>Total bulan ini</span><strong>{compact(expense)}</strong></div></div><div className="category-legend">{data.slice(0,4).map((d,i)=><div key={d.name}><span><i className="dot" style={{background:PALETTE[i%PALETTE.length]}}/>{d.name}</span><strong>{number(d.value)}</strong></div>)}</div></>}</section>;
}

function Dashboard({user,accounts,allAccounts,transactions,scope,month,hidden,setHidden,onPage,onNew,onEdit,onDelete,pendingCount,onReview}) {
  const ids=useMemo(()=>new Set(accounts.map(x=>x.id)),[accounts]);
  // Transaksi milik rekening yang sedang ditampilkan (sumber) — dipakai untuk pemasukan/pengeluaran.
  const ownedTx=useMemo(()=>transactions.filter(t=>ids.has(t.account_id)),[transactions,ids]);
  const current=ownedTx.filter(t=>t.occurred_on.startsWith(month));
  const income=sum(current.filter(isRealIncome),t=>t.amount);
  const expense=sum(current.filter(isSpending),t=>t.amount);
  const saving=sum(current.filter(isSaving),t=>t.amount);
  const balance=sum(accounts,a=>getBalance(a,transactions));
  const graph=Array.from({length:6},(_,i)=>{const m=shiftMonth(month,i-5);const slice=ownedTx.filter(t=>t.occurred_on.startsWith(m));return {label:shortMonth(m),pemasukan:sum(slice.filter(isRealIncome),t=>t.amount),pengeluaran:sum(slice.filter(isSpending),t=>t.amount)}});
  const categoryData=Object.entries(current.filter(isSpending).reduce((a,t)=>({...a,[t.subcategory||t.category]:(a[t.subcategory||t.category]||0)+Number(t.amount)}),{})).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  return <div className="page-stack"><div className="dashboard-head"><div><span className="eyebrow">OVERVIEW KEUANGAN</span><h2>Uang kita, lebih tertata <span className="inline-heart">♡</span></h2><p>Kelola hari ini, untuk rencana besar nanti.</p></div><WelcomeBadge name={monthLabel(month)}/></div>
    <section className="balance-hero"><div className="balance-orbit orbit-one"/><div className="balance-orbit orbit-two"/><div className="balance-hero-top"><span><Wallet size={18}/> Total saldo yang dapat diakses</span><IconButton label={hidden?'Tampilkan nominal':'Sembunyikan nominal'} onClick={()=>setHidden(!hidden)} className="hero-eye">{hidden?<EyeOff size={20}/>:<Eye size={20}/>}</IconButton></div><div className="balance-value">{formatValue(balance,hidden)}</div><div className="balance-hero-foot"><span><span className="glow-dot"/> {scopeText[scope]}</span><span>Saldo awal + transaksi tercatat</span></div></section>
    {pendingCount>0&&<button className="review-banner" onClick={onReview}><Mail size={18}/><span><strong>{pendingCount} transaksi dari Gmail</strong> perlu kamu review</span><ArrowRight size={16}/></button>}
    <div className="summary-grid four"><div className="summary-card"><div className="summary-icon income-icon"><ArrowDownLeft size={20}/></div><div><span>Pemasukan</span><strong>{formatValue(income,hidden)}</strong><small><TrendingUp size={13}/> Tanpa transfer & jual aset</small></div></div><div className="summary-card"><div className="summary-icon expense-icon"><ArrowUpRight size={20}/></div><div><span>Pengeluaran</span><strong>{formatValue(expense,hidden)}</strong><small><TrendingDown size={13}/> Kebutuhan + Keinginan</small></div></div><div className="summary-card"><div className="summary-icon saving-icon"><PiggyBank size={20}/></div><div><span>Ditabung</span><strong>{formatValue(saving,hidden)}</strong><small><PiggyBank size={13}/> Kategori Tabungan</small></div></div><div className="summary-card"><div className="summary-icon net-icon"><BarChart3 size={20}/></div><div><span>Sisa</span><strong>{formatValue(income-expense-saving,hidden)}</strong><small>Masuk − keluar − tabung</small></div></div></div>
    {accounts.length===0&&<div className="start-card"><div><span className="eyebrow">MULAI DI SINI</span><h3>Belum ada rekening.</h3><p>Buat rekening bersama atau pribadi, lalu catat transaksi pertamamu.</p></div><button className="btn btn-primary" onClick={()=>onNew('account')}><Plus size={17}/> Tambah rekening</button></div>}
    <div className="insights-grid"><InsightGraph data={graph} hidden={hidden}/><CategoryGraph data={categoryData} expense={expense} hidden={hidden}/></div>
    <section className="surface recent-section"><div className="panel-heading"><div><span className="eyebrow">AKTIVITAS</span><h3>Transaksi terbaru</h3></div><button className="link-button view-all" onClick={()=>onPage('transactions')}>Lihat semua <ArrowRight size={16}/></button></div><TransactionList items={transactions.filter(t=>(ids.has(t.account_id)||ids.has(t.to_account_id))&&t.occurred_on.startsWith(month)).slice(0,5)} accounts={allAccounts||accounts} userId={user.id} hidden={hidden} onEdit={onEdit} onDelete={onDelete} emptyAction={accounts.length?()=>onNew('transaction'):undefined}/></section>
  </div>;
}
function TransactionsPage({items,accounts,userId,hidden,onEdit,onDelete,onNew,inbox,onApproveInbox,onRejectInbox,tab,setTab}){
  const [search,setSearch]=useState(''),[kind,setKind]=useState('all');
  const byId=useMemo(()=>Object.fromEntries(accounts.map(a=>[a.id,a])),[accounts]);
  const shown=useMemo(()=>items.filter(t=>(kind==='all'||t.kind===kind)&&(`${t.category} ${t.subcategory||''} ${t.note||''} ${byId[t.account_id]?.name||''}`).toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))),[items,kind,search,byId]);
  return <section className="surface transaction-page"><div className="panel-heading"><div><span className="eyebrow">RIWAYAT</span><h3>{tab==='review'?'Perlu review':'Semua transaksi'} <span className="count-pill">{tab==='review'?inbox.length:shown.length}</span></h3></div><button className="btn btn-primary desktop-new" onClick={()=>onNew('transaction')} disabled={!accounts.length}><Plus size={16}/> Transaksi</button></div>
    <div className="tab-row"><Segmented label="Tampilan transaksi" value={tab} onChange={setTab} options={[{value:'history',label:'Riwayat'},{value:'review',label:`Perlu review${inbox.length?` (${inbox.length})`:''}`}]}/></div>
    {tab==='review'?<InboxList items={inbox} hidden={hidden} onApprove={onApproveInbox} onReject={onRejectInbox}/>:<>
    <div className="transaction-toolbar"><div className="search-field"><Search size={18}/><input aria-label="Cari transaksi" placeholder="Cari kategori, rekening, atau catatan..." value={search} onChange={e=>setSearch(e.target.value)}/></div><Segmented label="Filter jenis transaksi" value={kind} onChange={setKind} options={[{value:'all',label:'Semua'},{value:'income',label:'Masuk'},{value:'expense',label:'Keluar'},{value:'transfer',label:'⇄'}]}/></div>{shown.length?<TransactionList items={shown} accounts={accounts} userId={userId} hidden={hidden} onEdit={onEdit} onDelete={onDelete}/>:<EmptyState icon={Search} title="Tidak ada transaksi cocok" description="Coba ubah pencarian, filter, atau periode yang dipilih." action={accounts.length&&!items.length?'Tambah transaksi':undefined} onAction={()=>onNew('transaction')}/>}</>}</section>;
}

// ---------- Budget ----------
const pctClass=p=>p>1?'over':p>=0.8?'warn':'ok';
function ProgressLine({budget,actual,hidden}){
  const p=budget>0?actual/budget:actual>0?2:0;
  return <div className="budget-progress"><div className={`budget-bar ${pctClass(p)}`}><i style={{width:`${Math.min(100,p*100)}%`}}/></div><div className="budget-numbers"><span>{hidden?'•••':number(actual)} <em>dari {hidden?'•••':number(budget)}</em></span><strong className={pctClass(p)}>{budget>0?`${Math.round(p*100)}%`:actual>0?'tanpa budget':'—'}</strong></div></div>;
}
function buildBudget(budgets,totals,year,month){
  const monthIdx=Number(month.slice(5,7));
  const expense=totals.filter(t=>t.kind==='expense');
  const actualOf=(pred,m)=>sum(expense.filter(t=>(m?t.month===m:(t.month.startsWith(`${year}-`)&&t.month<=month))&&pred(t)),t=>t.total);
  const groups=EXPENSE_GROUPS.map(g=>{
    const rows=budgets.filter(b=>b.year===year&&b.category===g);
    const groupRow=rows.find(r=>!r.subcategory);
    const subRows=rows.filter(r=>r.subcategory).sort((a,b)=>Number(b.monthly_amount)-Number(a.monthly_amount));
    const lines=subRows.map(r=>({row:r,name:r.subcategory,budget:Number(r.monthly_amount),actual:actualOf(t=>t.category===g&&t.subcategory===r.subcategory,month)}));
    const known=new Set(subRows.map(r=>r.subcategory));
    if(!groupRow){const extra={};expense.filter(t=>t.month===month&&t.category===g&&!known.has(t.subcategory)).forEach(t=>{extra[t.subcategory||'(tanpa sub)']=(extra[t.subcategory||'(tanpa sub)']||0)+Number(t.total)});Object.entries(extra).forEach(([name,actual])=>lines.push({row:null,name,budget:0,actual}))}
    const budget=groupRow?Number(groupRow.monthly_amount):sum(subRows,r=>r.monthly_amount);
    return {name:g,groupRow,lines,budget,actual:actualOf(t=>t.category===g,month),ytdBudget:budget*monthIdx,ytdActual:actualOf(t=>t.category===g)};
  });
  const income=sum(totals.filter(t=>t.month===month&&t.kind==='income'&&!INTERNAL_INCOME.includes(t.subcategory)),t=>t.total);
  return {groups,income,budget:sum(groups,g=>g.budget),actual:sum(groups,g=>g.actual),hasBudget:budgets.some(b=>b.year===year)};
}
function BudgetPage({budgets,fetchTotals,dataVersion,month,hidden,shareInfo,onEditBudget,onNewBudget}){
  const year=Number(month.slice(0,4));
  const [totals,setTotals]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;setError('');fetchTotals(year).then(r=>{if(alive)setTotals(r||[])}).catch(e=>{if(alive){setError(e.message||'Gagal memuat realisasi budget.');setTotals([])}});return()=>{alive=false}},[year,fetchTotals,dataVersion]);
  const view=useMemo(()=>totals?buildBudget(budgets,totals,year,month):null,[budgets,totals,year,month]);
  if(!view)return <section className="surface"><div className="masked-graph"><RefreshCw size={22} className="spinning"/><span>Menghitung realisasi budget...</span></div></section>;
  const remaining=view.budget-view.actual;
  return <div className="page-stack">
    <div className="page-intro"><div><span className="eyebrow">BUDGET {year}</span><h2>Rencana vs realisasi</h2><p>{monthLabel(month)} · kategori Budggt.</p></div><button className="btn btn-primary desktop-new" onClick={onNewBudget}><Plus size={17}/> Baris budget</button></div>
    {error&&<div className="feedback error" role="alert">{error}</div>}
    {!view.hasBudget?<section className="surface"><EmptyState icon={Target} title={`Belum ada budget ${year}`} description="Jalankan seed_budget_2027.sql di Supabase, atau tambahkan baris budget satu per satu." action="Tambah baris budget" onAction={onNewBudget}/></section>:<>
    <div className="summary-grid four"><div className="summary-card"><div className="summary-icon net-icon"><Target size={20}/></div><div><span>Total budget</span><strong>{formatValue(view.budget,hidden)}</strong><small>Termasuk tabungan</small></div></div><div className="summary-card"><div className="summary-icon expense-icon"><ArrowUpRight size={20}/></div><div><span>Terpakai</span><strong>{formatValue(view.actual,hidden)}</strong><small>{view.budget?`${Math.round(view.actual/view.budget*100)}% dari budget`:'—'}</small></div></div><div className="summary-card"><div className="summary-icon saving-icon"><PiggyBank size={20}/></div><div><span>Sisa budget</span><strong className={remaining<0?'is-over':''}>{formatValue(remaining,hidden)}</strong><small>{remaining<0?'Melewati budget':'Masih aman'}</small></div></div><div className="summary-card"><div className="summary-icon income-icon"><ArrowDownLeft size={20}/></div><div><span>Pemasukan tercatat</span><strong>{formatValue(view.income,hidden)}</strong><small>Bulan ini</small></div></div></div>
    {view.groups.map(g=><section className="surface budget-group" key={g.name}><div className="panel-heading"><div><span className="eyebrow">{g.name.toUpperCase()}</span><h3>{formatValue(g.budget,hidden)} <small className="muted-inline">/ bulan</small></h3></div>{g.groupRow&&<IconButton label={`Edit budget ${g.name}`} onClick={()=>onEditBudget(g.groupRow)}><Pencil size={16}/></IconButton>}</div>
      <ProgressLine budget={g.budget} actual={g.actual} hidden={hidden}/>
      {g.groupRow?.note&&<p className="budget-note">{g.groupRow.note}</p>}
      {g.lines.length>0&&<div className="budget-lines">{g.lines.map(l=><button className="budget-line" key={l.name} onClick={()=>l.row?onEditBudget(l.row):onNewBudget()}><span className="budget-line-name">{l.name}{!l.row&&<em> · belum dibudget</em>}</span><ProgressLine budget={l.budget} actual={l.actual} hidden={hidden}/></button>)}</div>}
      <div className="budget-ytd">Januari–{monthLabel(month).split(' ')[0]}: {hidden?'•••':number(g.ytdActual)} dari {hidden?'•••':number(g.ytdBudget)}</div>
    </section>)}</>}
    <p className="tiny-note budget-privacy"><ShieldCheck size={14}/> {shareInfo}</p>
  </div>;
}
function AccountsPage({accounts,transactions,userId,hidden,onEdit,onDelete,onNew}){
  const groups=[{type:'shared',title:'Rekening bersama',desc:'Terlihat oleh kamu dan pasangan',Icon:Users},{type:'private',title:'Rekening pribadi saya',desc:'Hanya terlihat oleh akun kamu',Icon:LockKeyhole}];
  return <div className="page-stack"><div className="page-intro"><div><span className="eyebrow">DOMPET & REKENING</span><h2>Semua uang, satu tempat.</h2><p>Setiap rekening mempunyai aturan akses tersendiri.</p></div><button className="btn btn-primary desktop-new" onClick={()=>onNew('account')}><Plus size={17}/> Tambah rekening</button></div>{groups.map(g=>{const entries=accounts.filter(a=>a.visibility===g.type);return <section key={g.type} className="account-section"><div className="account-section-title"><div className={`account-group-icon ${g.type}`}><g.Icon size={18}/></div><div><h3>{g.title} <span className="count-pill">{entries.length}</span></h3><p>{g.desc}</p></div></div>{entries.length?<div className="account-grid">{entries.map(a=>{const balance=getBalance(a,transactions);return <article className="account-tile" key={a.id}><div className="account-tile-top"><span className="account-symbol"><CreditCard size={21}/></span><span className={`privacy-tag ${a.visibility==='shared'?'shared':'private'}`}>{a.visibility==='shared'?<Users size={12}/>:<LockKeyhole size={12}/>} {a.visibility==='shared'?'Bersama':'Pribadi'}</span></div><h4>{a.name}</h4><p>Saldo tercatat</p><strong>{formatValue(balance,hidden)}</strong><div className="account-tile-bottom"><small>{a.owner_id===userId?'Dibuat oleh kamu':'Dibuat oleh pasangan'}</small>{a.owner_id===userId&&<div><IconButton label={`Edit rekening ${a.name}`} onClick={()=>onEdit(a)}><Pencil size={16}/></IconButton><IconButton label={`Hapus rekening ${a.name}`} onClick={()=>onDelete(a)}><Trash2 size={16}/></IconButton></div>}</div></article>})}</div>:<div className="group-empty">Belum ada rekening {g.type==='shared'?'bersama':'pribadi'} yang dapat kamu akses.</div>}</section>})}</div>;
}
function GmailCard({isDemo,gmail}){
  const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState('');
  const status=gmail.status;
  const copy=async(text,what)=>{try{await navigator.clipboard.writeText(text);setCopied(what)}catch{setCopied('')}};
  async function create(){if(status?.active&&!window.confirm('Token lama akan dicabut. Apps Script lama perlu diisi token baru. Lanjut?'))return;setBusy(true);try{setToken(await gmail.create())}finally{setBusy(false)}}
  async function revoke(){if(!window.confirm('Cabut token? Sinkronisasi Gmail berhenti sampai token baru dibuat.'))return;setBusy(true);try{await gmail.revoke();setToken('')}finally{setBusy(false)}}
  return <section className="surface family-box"><div className="family-card-icon family-gmail"><Mail size={23}/></div><h3>Sinkron otomatis dari Gmail</h3><p className="muted">Notifikasi transaksi bank & investasi di Gmail kamu dibaca oleh Google Apps Script milikmu sendiri, lalu dikirim ke sini. Yang kategorinya yakin langsung tercatat; sisanya masuk <strong>Perlu review</strong>.</p>
    <div className="privacy-row"><span><KeyRound size={18}/></span><div><strong>Status token</strong><p>{isDemo?'Tidak tersedia di mode demo.':status?.active?`Aktif · terakhir dipakai ${status.last_used_at?new Date(status.last_used_at).toLocaleString('id-ID'):'belum pernah'}`:'Belum ada token.'}</p></div></div>
    {token&&<><div className="invite-label">TOKEN GMAIL (HANYA TAMPIL SEKALI)</div><div className="invite-code"><code>{token}</code><IconButton label="Salin token" onClick={()=>copy(token,'token')}><Copy size={18}/></IconButton></div><p className="tiny-note">{copied==='token'?'Token disalin. ':''}Tempel ke Script Properties <code>INGEST_TOKEN</code> di Apps Script. Jangan bagikan ke siapa pun.</p></>}
    {!isDemo&&gmail.url&&<><div className="invite-label">SUPABASE_URL & PUBLISHABLE_KEY</div><div className="invite-code"><code>{gmail.url}</code><IconButton label="Salin URL" onClick={()=>copy(gmail.url,'url')}><Copy size={18}/></IconButton></div><div className="invite-code"><code>{gmail.key}</code><IconButton label="Salin key" onClick={()=>copy(gmail.key,'key')}><Copy size={18}/></IconButton></div></>}
    <div className="button-row"><button className="btn btn-primary" disabled={isDemo||busy} onClick={create}><KeyRound size={16}/> {status?.active?'Buat token baru':'Buat token'}</button>{status?.active&&<button className="btn btn-outline" disabled={isDemo||busy} onClick={revoke}>Cabut</button>}</div>
  </section>;
}
function FamilyPage({household,user,members,me,isDemo,onCopy,onSignOut,onExitDemo,onToggleShare,gmail}){
  return <div className="page-stack"><div className="page-intro"><div><span className="eyebrow">RUANG KELUARGA</span><h2>Keuangan yang transparan, privasi tetap aman.</h2><p>Berbagi rencana bersama, tanpa harus membagikan semuanya.</p></div></div><div className="family-cards">
    <section className="surface family-box"><div className="family-card-icon"><Users size={23}/></div><h3>{household.name}</h3><div className="member-list">{members.map(m=><div className="member" key={m.id}><Avatar name={m.display_name}/><span><strong>{m.display_name}{m.id===user.id?' (kamu)':''}</strong><small>{m.share_totals?'Membagikan total ke budget':'Total pribadi tidak dibagikan'}</small></span></div>)}</div>{members.length<2&&<><div className="invite-label">KODE UNDANGAN PASANGAN</div><div className="invite-code"><code>{isDemo?'DEMO — tanpa undangan':household.invite_code}</code><IconButton label="Salin kode undangan" disabled={isDemo} onClick={onCopy}><Copy size={18}/></IconButton></div><p className="tiny-note">Jangan membagikan kode ini selain kepada pasangan.</p></>}</section>
    <section className="surface family-box"><div className="family-card-icon"><Target size={23}/></div><h3>Budget keluarga</h3><p className="muted">Agar budget menghitung pengeluaran berdua, masing-masing perlu membagikan <strong>total per kategori</strong> dari rekening pribadinya. Detail transaksi tetap pribadi.</p><label className="toggle-row"><input type="checkbox" checked={Boolean(me?.share_totals)} disabled={isDemo} onChange={e=>onToggleShare(e.target.checked)}/><span><strong>Bagikan total pribadi saya ke budget</strong><small>Pasangan hanya melihat angka total, misal "Makan Rp1,2 jt".</small></span></label></section>
    <GmailCard isDemo={isDemo} gmail={gmail}/>
    <section className="surface family-box account-settings"><div className="family-card-icon family-settings"><Settings2 size={23}/></div><h3>Akun kamu</h3><p className="muted">{isDemo?'demo@familyfinance.app':user.email}</p>{isDemo?<button className="btn btn-outline full" onClick={onExitDemo}><ArrowRight size={17}/> Kembali ke halaman masuk</button>:<button className="btn btn-outline full" onClick={onSignOut}><LogOut size={17}/> Keluar akun</button>}</section>
  </div></div>;
}

function FinanceShell({user,household,accounts,transactions,budgets,inbox,members,me,fetchTotals,dataVersion,gmail,onSaveAccount,onSaveTransaction,onDeleteAccount,onDeleteTransaction,onSaveBudget,onDeleteBudget,onRejectInbox,onToggleShare,onRefresh,onSignOut,isDemo=false,sync='online',busy=false}) {
  const [page,setPage]=useState('dashboard'),[txTab,setTxTab]=useState('history'),[scope,setScope]=useState('all'),[month,setMonth]=useState(monthNow()),[hidden,setHidden]=useState(false),[modal,setModal]=useState(null),[toast,setToast]=useState(null),[isOnline,setIsOnline]=useState(typeof navigator!=='undefined'?navigator.onLine:true);
  useEffect(()=>{const yes=()=>setIsOnline(true),no=()=>setIsOnline(false);window.addEventListener('online',yes);window.addEventListener('offline',no);return()=>{window.removeEventListener('online',yes);window.removeEventListener('offline',no)}},[]);
  const filteredAccounts=useMemo(()=>accounts.filter(a=>scope==='all'||a.visibility===scope),[accounts,scope]);
  const ids=useMemo(()=>new Set(filteredAccounts.map(a=>a.id)),[filteredAccounts]);
  const inScope=t=>ids.has(t.account_id)||(t.to_account_id&&ids.has(t.to_account_id))||(scope==='all'&&!accounts.some(a=>a.id===t.account_id));
  const filteredTransactions=useMemo(()=>transactions.filter(t=>inScope(t)&&t.occurred_on.startsWith(month)),[transactions,ids,month,scope,accounts]);
  const notify=(message,type='success')=>setToast({message,type});
  const guarded=async(fn,success)=>{try{await fn();notify(success)}catch(err){notify(err.message||'Operasi gagal. Coba kembali.','error');throw err}};
  const saveAccount=(payload,existing)=>guarded(()=>onSaveAccount(payload,existing),existing?'Rekening diperbarui':'Rekening ditambahkan');
  const saveTransaction=(payload,existing,inboxItem)=>guarded(()=>onSaveTransaction(payload,existing,inboxItem),inboxItem?'Transaksi dari Gmail disetujui':existing?'Transaksi diperbarui':'Transaksi berhasil disimpan');
  const saveBudget=(payload,existing)=>guarded(()=>onSaveBudget(payload,existing),'Budget disimpan');
  const deleteBudget=row=>guarded(()=>onDeleteBudget(row),'Baris budget dihapus');
  async function rejectInbox(it){try{await onRejectInbox(it);notify('Email diabaikan')}catch(err){notify(err.message||'Gagal','error')}}
  async function toggleShare(v){try{await onToggleShare(v);notify(v?'Total pribadimu kini ikut dihitung di budget':'Total pribadimu tidak lagi dibagikan')}catch(err){notify(err.message||'Gagal','error')}}
  async function deleteTx(tx){if(!window.confirm(`Hapus transaksi ${labelFor(tx)} sebesar ${number(tx.amount)}?`))return;try{await onDeleteTransaction(tx);notify('Transaksi dihapus')}catch(err){notify(err.message||'Gagal menghapus transaksi','error')}}
  async function deleteAccount(a){if(transactions.some(t=>t.account_id===a.id||t.to_account_id===a.id)){notify('Rekening memiliki transaksi. Hapus atau pindahkan transaksi sebelum menghapus rekening.','error');return}if(!window.confirm(`Hapus rekening ${a.name}?`))return;try{await onDeleteAccount(a);notify('Rekening dihapus')}catch(err){notify(err.message||'Gagal menghapus rekening','error')}}
  async function copyCode(){try{await navigator.clipboard.writeText(household.invite_code);notify('Kode undangan disalin')}catch{notify('Salin kode secara manual dari kolom undangan.','error')}}
  function newItem(type){if(type==='transaction'&&!accounts.length){setPage('accounts');notify('Buat rekening terlebih dahulu sebelum mencatat transaksi.');return}setModal({type})}
  const goReview=()=>{setPage('transactions');setTxTab('review')};
  const sharers=members.filter(m=>m.id!==user.id&&m.share_totals).map(m=>m.display_name);
  const shareInfo=`Realisasi = rekening bersama + semua rekening pribadimu${sharers.length?` + total pribadi ${sharers.join(', ')}`:''}.${members.length>1&&!sharers.length?' Pasangan belum membagikan total pribadinya (menu Keluarga).':''}`;
  const current=navItems.find(n=>n.id===page)||navItems[0];
  const navButton=id=>{const {label,Icon}=navItems.find(n=>n.id===id);return <button aria-current={page===id?'page':undefined} className={page===id?'active':''} key={id} onClick={()=>setPage(id)}><Icon size={21}/><span>{label}</span>{id==='transactions'&&inbox.length>0&&<i className="nav-badge">{inbox.length}</i>}</button>};
  return <div className="app-layout">
    <aside className="sidebar"><div className="sidebar-header"><Brand/><p>Keuangan terasa lebih ringan, bersama.</p></div><div className="sidebar-family"><div className="family-mark"><Users size={19}/></div><div><strong>{household.name}</strong><span>Ruang keluarga</span></div><ChevronDown size={16}/></div><div className="sidebar-label">MENU UTAMA</div><nav className="sidebar-nav" aria-label="Navigasi utama">{navItems.map(({id,label,Icon})=><button key={id} aria-current={page===id?'page':undefined} className={`side-link ${page===id?'is-active':''}`} onClick={()=>setPage(id)}><Icon size={20}/>{label}{id==='transactions'&&inbox.length>0&&<span className="count-pill">{inbox.length}</span>}{page===id&&<span className="active-pill"/>}</button>)}</nav><button className="btn btn-primary sidebar-add" onClick={()=>newItem('transaction')}><Plus size={18}/> Catat transaksi</button><div className="sidebar-bottom"><div className="sidebar-security"><ShieldCheck size={19}/><div><strong>Privasi terjaga</strong><span>Data pribadi tetap pribadi.</span></div></div><button className="profile-button" onClick={()=>setPage('family')}><Avatar name={me?.display_name||user.email||'K'}/><span><strong>{me?.display_name||'Akun saya'}</strong><small>Lihat pengaturan</small></span><MoreHorizontal size={19}/></button></div></aside>
    <div className="workspace"><header className="top-header"><div className="mobile-brand"><Brand compactMode/><span>family<span className="brand-accent">finance.</span></span></div><div className="header-context"><span>Ruang keluarga</span><strong>{household.name}</strong></div><div className="header-right"><span className={`sync-status ${!isOnline||sync==='offline'?'sync-offline':''}`} role="status">{!isOnline||sync==='offline'?<><CloudOff size={15}/> Offline</>:sync==='online'?<><Cloud size={15}/> Tersinkron</>:<><RefreshCw size={14} className="spinning"/> Menghubungkan</>}</span><IconButton label="Segarkan data" onClick={onRefresh} disabled={busy||isDemo}><RefreshCw size={19} className={busy?'spinning':''}/></IconButton><button className="avatar-button" onClick={()=>setPage('family')} aria-label="Keluarga & pengaturan"><Avatar name={me?.display_name||'K'}/></button></div></header>
      {isDemo&&<div className="demo-banner"><Sparkles size={16}/><span><strong>Mode demo.</strong> Data contoh hanya tersimpan sementara di browser.</span><button onClick={()=>window.location.assign(window.location.pathname)}>Keluar demo <ArrowRight size={14}/></button></div>}
      {!isOnline&&<div className="offline-banner"><WifiOff size={16}/> Kamu sedang offline. Perubahan baru tidak dapat disimpan hingga koneksi pulih.</div>}
      <div className="mobile-page-title"><span>{current.label}</span><strong>{household.name}</strong></div>
      <main className="main-content" id="main-content">
        {page!=='family'&&<div className="toolbar">{page!=='budget'?<div className="scope-control"><span className="toolbar-caption">Tampilkan</span><Segmented label="Cakupan rekening" value={scope} onChange={setScope} options={[{value:'all',label:'Semua'},{value:'shared',label:'Bersama'},{value:'private',label:'Pribadi'}]}/></div>:<div className="scope-control"><span className="toolbar-caption">Budget keluarga</span></div>}{page!=='accounts'&&<div className="period-control"><CalendarDays size={18}/><input type="month" aria-label="Pilih bulan" value={month} onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value))setMonth(e.target.value)}}/></div>}</div>}
        {page==='dashboard'&&<Dashboard user={user} accounts={filteredAccounts} allAccounts={accounts} transactions={transactions} scope={scope} month={month} hidden={hidden} setHidden={setHidden} onPage={setPage} onNew={newItem} onEdit={t=>setModal({type:'transaction',item:t})} onDelete={deleteTx} pendingCount={inbox.length} onReview={goReview}/>}
        {page==='transactions'&&<TransactionsPage items={filteredTransactions} accounts={accounts} userId={user.id} hidden={hidden} onEdit={t=>setModal({type:'transaction',item:t})} onDelete={deleteTx} onNew={newItem} inbox={inbox} onApproveInbox={it=>setModal({type:'transaction',draft:it})} onRejectInbox={rejectInbox} tab={txTab} setTab={setTxTab}/>}
        {page==='budget'&&<BudgetPage budgets={budgets} fetchTotals={fetchTotals} dataVersion={dataVersion} month={month} hidden={hidden} shareInfo={shareInfo} onEditBudget={b=>setModal({type:'budget',item:b})} onNewBudget={()=>setModal({type:'budget'})}/>}
        {page==='accounts'&&<AccountsPage accounts={filteredAccounts} transactions={transactions} userId={user.id} hidden={hidden} onEdit={a=>setModal({type:'account',item:a})} onDelete={deleteAccount} onNew={newItem}/>}
        {page==='family'&&<FamilyPage household={household} user={user} members={members} me={me} isDemo={isDemo} onCopy={copyCode} onSignOut={onSignOut} onExitDemo={()=>window.location.assign(window.location.pathname)} onToggleShare={toggleShare} gmail={gmail}/>}
        <footer className="app-footer">Family Finance · Catatan lebih rapi, rencana lebih pasti. <span>♡</span></footer>
      </main>
    </div>
    <nav className="bottom-nav" aria-label="Navigasi bawah">{BOTTOM_NAV.slice(0,2).map(navButton)}<button className="bottom-add" aria-label="Tambah transaksi" onClick={()=>newItem('transaction')}><Plus size={29}/></button>{BOTTOM_NAV.slice(2).map(navButton)}</nav>
    <Notice notice={toast} onClose={()=>setToast(null)}/>
    {modal?.type==='account'&&<AccountSheet existing={modal.item} onClose={()=>setModal(null)} onSave={saveAccount}/>}
    {modal?.type==='transaction'&&<TransactionSheet existing={modal.item} draft={modal.draft} accounts={accounts} onClose={()=>setModal(null)} onSave={(payload,existing)=>saveTransaction(payload,existing,modal.draft)}/>}
    {modal?.type==='budget'&&<BudgetSheet existing={modal.item} year={Number(month.slice(0,4))} onClose={()=>setModal(null)} onSave={saveBudget} onDelete={deleteBudget}/>}
  </div>;
}

function LiveApp(){
  const [user,setUser]=useState(undefined),[household,setHousehold]=useState(undefined),[accounts,setAccounts]=useState([]),[transactions,setTransactions]=useState([]),[budgets,setBudgets]=useState([]),[inbox,setInbox]=useState([]),[members,setMembers]=useState([]),[tokenStatus,setTokenStatus]=useState(null),[dataVersion,setDataVersion]=useState(0),[busy,setBusy]=useState(false),[sync,setSync]=useState('connecting'),[error,setError]=useState(''),[reload,setReload]=useState(0);
  useEffect(()=>{if(!configured)return;let alive=true;supabase.auth.getUser().then(({data,error})=>{if(!alive)return;setUser(data?.user||null);if(error)setError(error.message)}).catch(err=>{if(alive){setUser(null);setError(err.message)}});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(!alive)return;setUser(session?.user||null);if(!session){setHousehold(undefined);setAccounts([]);setTransactions([]);setBudgets([]);setInbox([])}});return()=>{alive=false;subscription.unsubscribe()}},[]);
  useEffect(()=>{if(!user)return;let alive=true;setHousehold(undefined);(async()=>{try{const {data:member,error:e}=await supabase.from('household_members').select('household_id').eq('user_id',user.id).maybeSingle();if(e)throw e;if(!member){if(alive)setHousehold(null);return}const {data:h,error:he}=await supabase.from('households').select('*').eq('id',member.household_id).single();if(he)throw he;if(alive)setHousehold(h)}catch(err){if(alive){setError(err.message);setHousehold(null)}}})();return()=>{alive=false}},[user?.id,reload]);
  const loadData=useCallback(async()=>{if(!household?.id)return;setBusy(true);try{
    const [a,t,b,i,m,ts]=await Promise.all([
      supabase.from('accounts').select('*').eq('household_id',household.id).order('created_at'),
      supabase.from('transactions').select('*').eq('household_id',household.id).order('occurred_on',{ascending:false}).order('created_at',{ascending:false}).limit(3000),
      supabase.from('budgets').select('*').eq('household_id',household.id),
      supabase.from('inbox_items').select('*').eq('status','pending').order('occurred_on',{ascending:false}).limit(200),
      supabase.from('household_members').select('user_id').eq('household_id',household.id),
      supabase.rpc('ingest_token_status')]);
    const firstError=[a,t,b,i,m].find(r=>r.error)?.error;if(firstError)throw firstError;
    const ids=(m.data||[]).map(x=>x.user_id);const p=await supabase.from('profiles').select('*').in('id',ids);if(p.error)throw p.error;
    setAccounts(a.data||[]);setTransactions(t.data||[]);setBudgets(b.data||[]);setInbox(i.data||[]);setMembers(p.data||[]);setTokenStatus(ts.error?null:ts.data);setDataVersion(v=>v+1);setError('')
  }catch(e){setError(e.message||'Gagal mengambil data, periksa koneksi.')}finally{setBusy(false)}},[household?.id]);
  useEffect(()=>{loadData()},[loadData]);
  useEffect(()=>{if(!household?.id)return;setSync('connecting');const f='household_id=eq.'+household.id;const channel=supabase.channel('family-finance-'+household.id).on('postgres_changes',{event:'*',schema:'public',table:'accounts',filter:f},loadData).on('postgres_changes',{event:'*',schema:'public',table:'transactions',filter:f},loadData).on('postgres_changes',{event:'*',schema:'public',table:'budgets',filter:f},loadData).on('postgres_changes',{event:'*',schema:'public',table:'inbox_items',filter:f},loadData).subscribe(s=>{if(s==='SUBSCRIBED')setSync('online');else if(s==='CLOSED'||s==='TIMED_OUT'||s==='CHANNEL_ERROR')setSync('offline');else setSync('connecting')});const onFocus=()=>loadData();window.addEventListener('focus',onFocus);window.addEventListener('online',onFocus);return()=>{supabase.removeChannel(channel);window.removeEventListener('focus',onFocus);window.removeEventListener('online',onFocus)}},[household?.id,loadData]);
  const fetchTotals=useCallback(async year=>{const {data,error}=await supabase.rpc('household_totals',{p_from:`${year}-01-01`,p_to:`${year}-12-31`});if(error)throw error;return data||[]},[]);
  const onSaveAccount=async(payload,existing)=>{const q=existing?supabase.from('accounts').update(payload).eq('id',existing.id):supabase.from('accounts').insert({...payload,household_id:household.id,owner_id:user.id});const {error}=await q;if(error)throw error;await loadData()};
  const onSaveTransaction=async(payload,existing,inboxItem)=>{
    if(existing){const {error}=await supabase.from('transactions').update(payload).eq('id',existing.id);if(error)throw error}
    else{const extra=inboxItem?{source:'gmail',external_id:inboxItem.external_id}:{};const {data,error}=await supabase.from('transactions').insert({...payload,...extra,household_id:household.id,created_by:user.id}).select('id').single();if(error)throw error;
      if(inboxItem){const {error:ie}=await supabase.from('inbox_items').update({status:'approved',transaction_id:data.id}).eq('id',inboxItem.id);if(ie)throw ie}}
    await loadData()};
  const onDeleteTransaction=async t=>{const {error}=await supabase.from('transactions').delete().eq('id',t.id);if(error)throw error;await loadData()};
  const onDeleteAccount=async a=>{const {error}=await supabase.from('accounts').delete().eq('id',a.id);if(error)throw error;await loadData()};
  const onSaveBudget=async(payload,existing)=>{const q=existing?supabase.from('budgets').update({monthly_amount:payload.monthly_amount,note:payload.note,updated_by:user.id,updated_at:new Date().toISOString()}).eq('id',existing.id):supabase.from('budgets').insert({...payload,household_id:household.id});const {error}=await q;if(error)throw error;await loadData()};
  const onDeleteBudget=async row=>{const {error}=await supabase.from('budgets').delete().eq('id',row.id);if(error)throw error;await loadData()};
  const onRejectInbox=async it=>{const {error}=await supabase.from('inbox_items').update({status:'rejected'}).eq('id',it.id);if(error)throw error;await loadData()};
  const onToggleShare=async v=>{const {error}=await supabase.from('profiles').update({share_totals:v}).eq('id',user.id);if(error)throw error;await loadData()};
  const gmail={status:tokenStatus,url:import.meta.env.VITE_SUPABASE_URL,key:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    create:async()=>{const {data,error}=await supabase.rpc('create_ingest_token');if(error)throw error;await loadData();return data},
    revoke:async()=>{const {error}=await supabase.rpc('revoke_ingest_token');if(error)throw error;await loadData()}};
  if(!configured)return <ConfigMissing/>;
  if(user===undefined || (user&&household===undefined))return <div className="app-loading"><Brand/><div className="loader"/><p>Menyiapkan ruang keuangan...</p></div>;
  if(!user)return <><Auth onDemo={()=>window.location.assign('?demo=1')}/>{error&&<div className="fixed-error">{error}</div>}</>;
  if(!household)return <><Setup onDone={()=>setReload(x=>x+1)}/>{error&&<div className="fixed-error">{error}</div>}</>;
  const me=members.find(m=>m.id===user.id)||{id:user.id,display_name:user.user_metadata?.display_name||'Saya',share_totals:false};
  return <><FinanceShell user={user} household={household} accounts={accounts} transactions={transactions} budgets={budgets} inbox={inbox} members={members.length?members:[me]} me={me} fetchTotals={fetchTotals} dataVersion={dataVersion} gmail={gmail} onSaveAccount={onSaveAccount} onSaveTransaction={onSaveTransaction} onDeleteAccount={onDeleteAccount} onDeleteTransaction={onDeleteTransaction} onSaveBudget={onSaveBudget} onDeleteBudget={onDeleteBudget} onRejectInbox={onRejectInbox} onToggleShare={onToggleShare} onRefresh={loadData} onSignOut={()=>supabase.auth.signOut()} sync={sync} busy={busy}/>{error&&<div className="fixed-error" role="alert">{error} <button onClick={loadData}>Coba lagi</button></div>}</>;
}
function ConfigMissing(){return <div className="onboard-page"><div className="onboard-card"><Brand/><WelcomeBadge name="Siap dijalankan"/><h1>Family Finance siap dicoba.</h1><p className="muted">Lihat desain dan coba interaksi menggunakan data contoh, atau isi konfigurasi Supabase untuk menggunakan akun asli.</p><div className="config-steps"><p>Untuk menghubungkan cloud, isi file <code>.env</code>:</p><code>VITE_SUPABASE_URL=...<br/>VITE_SUPABASE_PUBLISHABLE_KEY=...</code></div><button className="btn btn-primary full" onClick={()=>window.location.assign('?demo=1')}>Jelajahi mode demo <ArrowRight size={18}/></button><p className="tiny-note">Demo tidak menggunakan database atau menyimpan transaksi sungguhan.</p></div></div>}

const DEMO_BUDGET=[['Kebutuhan','Makan',2800000],['Kebutuhan','Transport',1900000],['Kebutuhan','Home',1750000],['Kebutuhan','Kesehatan',350000],['Kebutuhan','Bodycare and Skincare',350000],['Kebutuhan','Biaya Transaksi',25000],['Keinginan','JAJAN',900000],['Keinginan','GIFT',300000],['Keinginan','Hobby',400000],['Keinginan','Online Subscription',100000],['Keinginan','others',500000],['Tabungan','',10225000]];
function makeDemo(){
  const household={id:'demo-family',name:'Keluarga Kita',invite_code:'demo-not-active'};
  const user={id:'demo-me',email:'demo@familyfinance.app',user_metadata:{display_name:'Uwi'}};
  const members=[{id:'demo-me',display_name:'Uwi',share_totals:true},{id:'demo-partner',display_name:'Vitto',share_totals:true}];
  const accounts=[{id:'demo-mandiri',name:'MANDIRI',visibility:'private',opening_balance:6500000,owner_id:user.id},{id:'demo-jago',name:'JAGO BAYAR',visibility:'private',opening_balance:1500000,owner_id:user.id},{id:'demo-skyz',name:'SKYZ',visibility:'private',opening_balance:0,owner_id:user.id},{id:'demo-kas',name:'Kas Bersama',visibility:'shared',opening_balance:3000000,owner_id:user.id}];
  const spend=[['Kebutuhan','Makan',[820000,640000,910000],'demo-jago'],['Kebutuhan','Transport',[410000,520000,380000],'demo-jago'],['Kebutuhan','Home',[452500,1350000],'demo-skyz'],['Keinginan','JAJAN',[255000,190000,320000],'demo-mandiri'],['Keinginan','GIFT',[150000,100000],'demo-mandiri'],['Kebutuhan','Kesehatan',[350000],'demo-skyz'],['Keinginan','others',[150000,105000],'demo-skyz'],['Tabungan','Reksadana',[1500000],'demo-mandiri'],['Tabungan','GORO',[500000],'demo-mandiri']];
  const tx=[];for(let i=5;i>=0;i--){const m=shiftMonth(monthNow(),-i);tx.push({id:`income-${m}`,account_id:'demo-mandiri',kind:'income',amount:11600000,category:'Pemasukan',subcategory:'Gaji',note:'Gaji',occurred_on:m+'-01',created_by:user.id,source:'manual'});
    tx.push({id:`tf-${m}`,account_id:'demo-mandiri',to_account_id:'demo-jago',kind:'transfer',amount:2000000,category:'Transfer',subcategory:'',note:'Isi Jago',occurred_on:m+'-02',created_by:user.id,source:'manual'});
    spend.forEach(([g,sub,amts,acc],j)=>amts.forEach((v,k)=>tx.push({id:`e-${m}-${j}-${k}`,account_id:acc,kind:'expense',amount:Math.round(v*(1+((i+j)%3)*0.08)),category:g,subcategory:sub,note:'',occurred_on:`${m}-${String(Math.min(i===0?Number(dateToday().slice(8)):28,3+j*3+k)).padStart(2,'0')}`,created_by:user.id,source:j%2?'gmail':'manual'})))}
  const year=Number(monthNow().slice(0,4));
  const budgets=[year,2027].flatMap(y=>DEMO_BUDGET.map(([category,subcategory,amount],i)=>({id:`b-${y}-${i}`,year:y,category,subcategory,monthly_amount:amount,note:category==='Tabungan'?'Dana Darurat 1,5 jt · Liburan 2,5 jt · Tanah/Rumah 5 jt · Investasi 1,225 jt':''})));
  const today=dateToday();
  const inbox=[{id:'in-1',external_id:'g1',sender:'noreply.livin@bankmandiri.co.id',subject:'Pembayaran QRIS Berhasil',merchant:'SUKA ROTI',kind:'expense',amount:38000,category:'Kebutuhan',subcategory:'',account_hint:'SKYZ',occurred_on:today,reason:'Merchant belum dikenal'},{id:'in-2',external_id:'g2',sender:'bca@bca.co.id',subject:'Internet Transaction Journal',merchant:'Transfer ke ENOH SULASTRI',kind:'expense',amount:210000,category:'',subcategory:'',account_hint:'BCA',occurred_on:today,reason:'Transfer keluar — tentukan kategori'}];
  return {household,user,members,accounts,budgets,inbox,tx:tx.sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on))};
}
function demoTotals(transactions,year){const map={};transactions.filter(t=>t.occurred_on.startsWith(`${year}-`)).forEach(t=>{const k=[t.occurred_on.slice(0,7),t.kind,t.category,t.subcategory||''].join('|');map[k]=(map[k]||0)+Number(t.amount)});return Object.entries(map).map(([k,total])=>{const [month,kind,category,subcategory]=k.split('|');return {month,kind,category,subcategory,total}})}
function DemoApp(){const sample=useMemo(makeDemo,[]),[accounts,setAccounts]=useState(sample.accounts),[transactions,setTransactions]=useState(sample.tx),[budgets,setBudgets]=useState(sample.budgets),[inbox,setInbox]=useState(sample.inbox),[members,setMembers]=useState(sample.members);
  const saveAccount=async(payload,existing)=>{setAccounts(a=>existing?a.map(x=>x.id===existing.id?{...x,...payload}:x):[...a,{...payload,id:`demo-a-${crypto.randomUUID()}`,owner_id:sample.user.id}])};
  const saveTransaction=async(payload,existing,inboxItem)=>{setTransactions(a=>existing?a.map(x=>x.id===existing.id?{...x,...payload}:x):[{...payload,id:`demo-t-${crypto.randomUUID()}`,created_by:sample.user.id,source:inboxItem?'gmail':'manual'},...a].sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on)));if(inboxItem)setInbox(s=>s.filter(x=>x.id!==inboxItem.id))};
  const saveBudget=async(payload,existing)=>setBudgets(s=>existing?s.map(x=>x.id===existing.id?{...x,monthly_amount:payload.monthly_amount,note:payload.note}:x):[...s,{...payload,id:`b-${crypto.randomUUID()}`}]);
  const deleteBudget=async row=>setBudgets(s=>s.filter(x=>x.id!==row.id));
  const deleteAccount=async a=>setAccounts(s=>s.filter(x=>x.id!==a.id));const deleteTransaction=async t=>setTransactions(s=>s.filter(x=>x.id!==t.id));
  const fetchTotals=useCallback(async year=>demoTotals(transactions,year),[transactions]);
  const me=members.find(m=>m.id===sample.user.id);
  return <FinanceShell isDemo user={sample.user} household={sample.household} accounts={accounts} transactions={transactions} budgets={budgets} inbox={inbox} members={members} me={me} fetchTotals={fetchTotals} dataVersion={transactions.length} gmail={{status:null}} onSaveAccount={saveAccount} onSaveTransaction={saveTransaction} onDeleteAccount={deleteAccount} onDeleteTransaction={deleteTransaction} onSaveBudget={saveBudget} onDeleteBudget={deleteBudget} onRejectInbox={async it=>setInbox(s=>s.filter(x=>x.id!==it.id))} onToggleShare={async v=>setMembers(s=>s.map(m=>m.id===sample.user.id?{...m,share_totals:v}:m))} onRefresh={()=>{}} onSignOut={()=>window.location.assign(window.location.pathname)} sync="online"/>;
}
export default function App(){return new URLSearchParams(window.location.search).has('demo')?<DemoApp/>:<LiveApp/>}
