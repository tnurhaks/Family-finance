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
import { goalPlan, monthsUntil } from './goals';
import { TAXONOMY, EXPENSE_GROUPS, INTERNAL_INCOME, isRealIncome, isSpending, isSaving, iconFor, labelFor } from './categories';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import './style.css';

const PALETTE = ['#f2643c', '#7b5ea7', '#f7a541', '#e0457b', '#ff9f7a', '#b07cc6', '#ffcb6b', '#a89ba8'];
const sum = (list, fn = x => x) => list.reduce((s, x) => s + Number(fn(x) || 0), 0);
const currency = new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0, maximumFractionDigits:2 });
const number = n => currency.format(Number(n) || 0);
const compact = n => new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
const dateToday = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const monthNow = () => dateToday().slice(0,7);
const monthLabel = s => new Date(`${s}-01T12:00:00`).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
const dateLabel = s => new Date(`${s}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const shortMonth = s => new Date(`${s}-01T12:00:00`).toLocaleDateString('en-GB',{month:'short'});
const shiftMonth = (s, offset) => { const [y,m] = s.split('-').map(Number); const d=new Date(y,m-1+offset,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
// Efek satu transaksi ke saldo satu rekening (transfer: keluar dari sumber, masuk ke tujuan).
const txDelta = (t, accountId) => (t.account_id===accountId ? (t.kind==='income'?1:-1)*Number(t.amount) : 0) + (t.kind==='transfer'&&t.to_account_id===accountId ? Number(t.amount) : 0);
const getBalance = (account, txs) => Number(account.opening_balance) + txs.reduce((n,t)=>n+txDelta(t,account.id),0);
const formatValue = (value, hidden) => hidden ? 'Rp •••••••' : number(value);
const scopeText = {all:'All access',shared:'Shared',private:'My private'};
const navItems = [{id:'dashboard',label:'Home',Icon:Home},{id:'transactions',label:'Transactions',Icon:ReceiptText},{id:'budget',label:'Budget',Icon:Target},{id:'accounts',label:'Accounts',Icon:Wallet},{id:'family',label:'Family',Icon:Users}];
const BOTTOM_NAV = ['dashboard','transactions','budget','accounts'];

function Brand({compactMode=false}) {
  return <div className="brand"><span className="brand-icon"><Wallet size={21} strokeWidth={2.4}/></span>{!compactMode&&<span>family<span className="brand-accent">finance.</span></span>}</div>;
}
function Avatar({name='Pengguna'}) { return <div className="avatar" aria-label={`Account ${name}`}>{name.trim().slice(0,1).toUpperCase()}</div>; }
function IconButton({label,onClick,children,className='',disabled=false}) {return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>}
function Notice({notice,onClose}) { return notice ? <div className={`toast ${notice.type==='error'?'toast-error':''}`} role="status"><span className="toast-symbol">{notice.type==='error'?<CircleHelp size={18}/>:<CheckCircle2 size={18}/>}</span><span>{notice.message}</span><IconButton label="Close message" onClick={onClose}><X size={17}/></IconButton></div> : null; }
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
      if(register)setMessage('Account created. Check your email to confirm it, then sign in.');
    } catch(err){setError(err.message||'Couldn\'t connect your account. Please try again.')} finally{setBusy(false)}
  }
  return <div className="auth-page"><div className="auth-visual"><Brand/><div className="auth-story"><div className="eyebrow light"><Sparkles size={16}/> Money, managed together</div><h1>One family.<br/><em>One goal.</em></h1><p>Planning ahead is easier when everything is tracked clearly — without giving up your privacy.</p><div className="auth-feature"><span><Check size={15}/> Shared & private accounts</span><span><Check size={15}/> Auto sync</span><span><Check size={15}/> Real-time dashboard</span></div></div><div className="auth-visual-footer">Made for your financial journey, together. ♡</div></div><main className="auth-main"><div className="auth-mobile-brand"><Brand/></div><div className="auth-card"><WelcomeBadge name="Welcome"/><h2>{register?'Start your money story together.':'Welcome back.'}</h2><p className="muted">{register?'Create your own account first. Your partner will have a separate one.':'Sign in to see your family finances.'}</p><form onSubmit={submit} className="form">{register&&<label>Nickname<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name"/></label>}<label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@email.com" autoComplete="email"/></label><label>Password<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={register?'new-password':'current-password'}/></label>{error&&<div className="feedback error" role="alert">{error}</div>}{message&&<div className="feedback success" role="status">{message}</div>}<button className="btn btn-primary full" disabled={busy}>{busy?'Processing...':register?'Create account':'Sign in'}<ArrowRight size={17}/></button></form><div className="auth-switch">{register?'Already have an account?':'New here?'} <button className="link-button" onClick={()=>{setRegister(!register);setError('');setMessage('')}}>{register?'Sign in':'Create an account'}</button></div><div className="auth-divider"><span>or</span></div><button className="btn btn-outline full" onClick={onDemo}><Eye size={17}/> Try the demo</button><p className="auth-footnote"><ShieldCheck size={15}/> Private accounts are only visible to their owner.</p></div></main></div>;
}

function Setup({onDone}) {
  const [tab,setTab]=useState('create'),[name,setName]=useState('Our Family'),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{const {error:e}=await supabase.rpc(tab==='create'?'create_household':'join_household',tab==='create'?{p_name:name.trim()}:{p_invite_code:code.trim()});if(e)throw e;onDone()}catch(e){setError(e.message||'Something went wrong. Please try again.')}finally{setBusy(false)}};
  return <div className="onboard-page"><div className="onboard-card"><Brand/><WelcomeBadge name="First step"/><h1>A small space for big dreams.</h1><p className="muted">Create a family space, then invite your partner with a private code. Up to two members for now.</p><Segmented label="Join a family" value={tab} onChange={v=>{setTab(v);setError('')}} options={[{value:'create',label:'Create family'},{value:'join',label:'Join family'}]}/><form className="form" onSubmit={submit}>{tab==='create'?<label>Family name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>:<label>Invite code<input required value={code} onChange={e=>setCode(e.target.value)} placeholder="Paste the code from your partner"/></label>}{error&&<div className="feedback error" role="alert">{error}</div>}<button className="btn btn-primary full" disabled={busy}>{busy?'Processing...':tab==='create'?'Create family space':'Join family'}<ArrowRight size={18}/></button></form><button className="link-button signout" onClick={()=>supabase.auth.signOut()}>Sign out</button></div></div>;
}

function MonthPicker({value,onChange}){
  const options=useMemo(()=>{const list=Array.from({length:42},(_,i)=>shiftMonth(monthNow(),i-27));if(!list.includes(value))list.push(value);return list.sort()},[value]);
  return <div className="period-control month-picker"><button type="button" className="month-step" aria-label="Previous month" onClick={()=>onChange(shiftMonth(value,-1))}>‹</button><CalendarDays size={16}/><select aria-label="Choose month" value={value} onChange={e=>onChange(e.target.value)}>{options.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select><button type="button" className="month-step" aria-label="Next month" onClick={()=>onChange(shiftMonth(value,1))}>›</button></div>;
}
function Sheet({title,onClose,children}) {
  useEffect(()=>{const old=document.body.style.overflow;document.body.style.overflow='hidden';const key=e=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',key)}},[onClose]);
  return <div className="sheet-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="sheet" role="dialog" aria-modal="true" aria-label={title}><div className="sheet-handle"/><div className="sheet-heading"><div><span className="eyebrow">FAMILY FINANCE</span><h2>{title}</h2></div><IconButton label="Close" onClick={onClose}><X size={20}/></IconButton></div>{children}</section></div>;
}
function AccountSheet({existing,currentBalance,onClose,onSave}) {
  const isCredit0=existing?.kind==='credit';
  const [name,setName]=useState(existing?.name||''),[visibility,setVisibility]=useState(existing?.visibility||'private'),[kind,setKind]=useState(existing?.kind||'bank'),
    [opening,setOpening]=useState(String(existing&&!isCredit0?Math.round((currentBalance??0)*100)/100:'0')),
    [limit,setLimit]=useState(String(existing?.credit_limit??'')),
    [available,setAvailable]=useState(String(existing&&isCredit0?Math.round((Number(existing.credit_limit||0)+(currentBalance??0))*100)/100:'')),
    [saving,setSaving]=useState(false),[error,setError]=useState('');
  const credit=kind==='credit';
  const used=credit&&limit!==''&&available!==''?Number(limit)-Number(available):0;
  async function submit(e){e.preventDefault();setError('');if(credit&&Number(available)>Number(limit)){setError('Available limit can\'t be higher than the total limit.');return}setSaving(true);try{await onSave({name:name.trim(),visibility,kind,credit_limit:credit?Number(limit):null,current_balance:credit?-(Number(limit)-Number(available)):Number(opening)},existing);onClose()}catch(err){setError(err.message||'Couldn\'t save the account.')}finally{setSaving(false)}}
  return <Sheet title={existing?'Edit account':'New account'} onClose={onClose}><form className="form sheet-form" onSubmit={submit}>
    <Segmented label="Account type" value={kind} onChange={setKind} options={[{value:'bank',label:'Bank / e-wallet'},{value:'credit',label:'Credit card'}]}/>
    <label>{credit?'Card name':'Account name'}<input autoFocus required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder={credit?'e.g. SKYZ':'e.g. JAGO BAYAR'}/></label>
    <div><div className="field-label">Who can see it?</div><div className="visibility-choices"><button type="button" className={visibility==='shared'?'chosen':''} onClick={()=>setVisibility('shared')}><Users size={18}/><strong>Shared</strong><small>Both of you can see it</small></button><button type="button" className={visibility==='private'?'chosen':''} onClick={()=>setVisibility('private')}><LockKeyhole size={18}/><strong>Private</strong><small>Only you</small></button></div></div>
    {credit?<>
      <label>Total limit (Rp)<input type="number" inputMode="numeric" min="0" step="1" required value={limit} onChange={e=>setLimit(e.target.value)} placeholder="e.g. 15000000"/></label>
      <label>Available limit now (Rp)<input type="number" inputMode="numeric" min="0" step="0.01" required value={available} onChange={e=>setAvailable(e.target.value)} placeholder="Check your banking app"/></label>
      {limit!==''&&available!==''&&<div className="context-note"><CreditCard size={16}/> Used {number(Math.max(0,used))} of {number(limit)}. Spending on this card lowers the available limit; paying the bill (a transfer to the card) restores it.</div>}
    </>:<>
      <label>Current balance (Rp)<input type="number" inputMode="decimal" step="0.01" required value={opening} onChange={e=>setOpening(e.target.value)}/></label>
      <p className="field-help"><Wallet size={15}/> Enter today's balance from your banking app. This is exactly what will show — new transactions after this will move it up or down.</p>
    </>}
    {error&&<div className="feedback error" role="alert">{error}</div>}
    <button className="btn btn-primary full" disabled={saving||!name.trim()||(credit&&(limit===''||available===''))}>{saving?'Saving...':'Save account'}<Check size={17}/></button></form></Sheet>;
}
// existing = transaksi yang diedit; draft = usulan dari email Gmail (belum tersimpan).
function TransactionSheet({existing,draft,accounts,onClose,onSave}) {
  const init=existing||draft||{};
  const guessAccount=draft?.account_hint?accounts.find(a=>a.name.trim().toUpperCase()===draft.account_hint.trim().toUpperCase())?.id:undefined;
  const firstGroup=EXPENSE_GROUPS.includes(init.category)?init.category:'Kebutuhan';
  const [kind,setKind]=useState(init.kind||'expense'),[accountId,setAccountId]=useState(existing?.account_id||guessAccount||(draft?'':accounts[0]?.id)||''),[toAccountId,setToAccountId]=useState(init.to_account_id||''),[amount,setAmount]=useState(String(init.amount??'')),[group,setGroup]=useState(firstGroup),[sub,setSub]=useState(init.subcategory||(draft?'':init.kind==='income'?'Gaji':'Makan')),[note,setNote]=useState(init.note||draft?.merchant||''),[date,setDate]=useState(init.occurred_on||dateToday()),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const subs=kind==='income'?TAXONOMY.Pemasukan:TAXONOMY[group]||[];
  const [customSub,setCustomSub]=useState(()=>Boolean(init.subcategory)&&!(init.kind==='income'?TAXONOMY.Pemasukan:TAXONOMY[firstGroup]||[]).includes(init.subcategory));
  const account=accounts.find(a=>a.id===accountId);
  const switchKind=v=>{setKind(v);setCustomSub(false);setSub(v==='income'?'Gaji':v==='expense'?TAXONOMY[group][0]:'')};
  const switchGroup=g=>{setGroup(g);setCustomSub(false);setSub(TAXONOMY[g][0])};
  async function submit(e){e.preventDefault();setSaving(true);setError('');try{await onSave({kind,account_id:accountId,amount:Number(amount),category:kind==='transfer'?'Transfer':kind==='income'?'Pemasukan':group,subcategory:kind==='transfer'?'':sub.trim(),to_account_id:kind==='transfer'&&toAccountId?toAccountId:null,note:note.trim(),occurred_on:date},existing);onClose()}catch(err){setError(err.message||'Couldn\'t save the transaction.')}finally{setSaving(false)}}
  return <Sheet title={existing?'Edit transaction':draft?'Review from Gmail':'New transaction'} onClose={onClose}><form className="form sheet-form" onSubmit={submit}>
    {draft&&<div className="context-note gmail-note"><Mail size={16}/><span><strong>{draft.subject||draft.sender}</strong>{draft.reason?` — ${draft.reason}`:''}</span></div>}
    <Segmented label="Transaction type" value={kind} onChange={switchKind} options={[{value:'expense',label:'↗ Expense'},{value:'income',label:'↙ Income'},{value:'transfer',label:'⇄ Transfer'}]}/>
    <label>Amount (Rp)<div className="amount-input-wrap"><span>Rp</span><input autoFocus aria-label="Amount in rupiah" type="number" inputMode="decimal" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></div></label>
    
    {kind!=='transfer'&&<div className="form-pair">
      {kind==='expense'?<label>Category<select value={group} onChange={e=>switchGroup(e.target.value)}>{EXPENSE_GROUPS.map(g=><option key={g} value={g}>{g}</option>)}</select></label>:<label>Category<select value="Pemasukan" disabled><option>Pemasukan</option></select></label>}
      <label>Subcategory<select value={customSub?'__other':sub} onChange={e=>{if(e.target.value==='__other'){setCustomSub(true);setSub('')}else{setCustomSub(false);setSub(e.target.value)}}}>{!customSub&&sub&&!subs.includes(sub)&&<option value={sub}>{sub}</option>}{!sub&&!customSub&&<option value="" disabled>Choose…</option>}{subs.map(c=><option key={c} value={c}>{c}</option>)}<option value="__other">Other…</option></select></label>
    </div>}
    {kind!=='transfer'&&customSub&&<label>New subcategory<input autoFocus required value={sub} onChange={e=>setSub(e.target.value)} maxLength={80} placeholder="Type a subcategory"/></label>}
    <div className="form-pair">{kind!=='transfer'?null:<label>To account<select value={toAccountId} onChange={e=>setToAccountId(e.target.value)}><option value="">Outside the app / to partner</option>{accounts.filter(a=>a.id!==accountId).map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>}<label>Date<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label></div>
    <label>{kind==='income'?'To account':'From account'}<select required value={accountId} onChange={e=>setAccountId(e.target.value)}>{!accountId&&<option value="" disabled>Choose account…</option>}{accounts.map(a=><option value={a.id} key={a.id}>{a.name} · {a.kind==='credit'?'Credit card':a.visibility==='shared'?'Shared':'Private'}</option>)}</select></label>
    {kind==='transfer'&&<div className="context-note"><ArrowLeftRight size={16}/> Transfers aren't counted as spending — they just move money. Paying a credit card bill counts as a transfer.</div>}
    {kind!=='transfer'&&account&&<div className="context-note">{account.visibility==='shared'?<Users size={16}/>:<LockKeyhole size={16}/>} {account.visibility==='shared'?'Your partner can see this transaction.':'Only you can see the details.'}</div>}
    <label>Note <span className="optional">(optional)</span><input maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Bakmi Jogja Mas Goen"/></label>
    {error&&<div className="feedback error" role="alert">{error}</div>}
    <button className="btn btn-primary full" disabled={saving||!accountId||!Number.isFinite(Number(amount))||Number(amount)<=0||(kind!=='transfer'&&!sub.trim())}>{saving?'Saving...':draft?'Approve & save':'Save transaction'}<Check size={17}/></button></form></Sheet>;
}
function BudgetSheet({existing,year,onClose,onSave,onDelete}) {
  const [group,setGroup]=useState(existing?.category||'Kebutuhan'),[sub,setSub]=useState(existing?.subcategory??''),[amount,setAmount]=useState(String(existing?.monthly_amount??'')),[note,setNote]=useState(existing?.note||''),[saving,setSaving]=useState(false),[error,setError]=useState('');
  async function submit(e){e.preventDefault();setSaving(true);setError('');try{await onSave({year,category:group,subcategory:sub.trim(),monthly_amount:Number(amount),note:note.trim()},existing);onClose()}catch(err){setError(err.message||'Couldn\'t save the budget.')}finally{setSaving(false)}}
  async function remove(){if(!window.confirm('Delete this budget line?'))return;try{await onDelete(existing);onClose()}catch(err){setError(err.message||'Couldn\'t delete.')}}
  return <Sheet title={existing?'Edit budget':`Budget ${year}`} onClose={onClose}><form className="form sheet-form" onSubmit={submit}>
    {!existing&&<Segmented label="Category" value={group} onChange={g=>{setGroup(g);setSub('')}} options={EXPENSE_GROUPS.map(g=>({value:g,label:g}))}/>}
    {existing?<div className="context-note"><Target size={16}/> {existing.category}{existing.subcategory?` · ${existing.subcategory}`:' · whole category'}</div>:<label>Subcategory <span className="optional">(leave empty = all of {group})</span><input list="budget-sub" value={sub} onChange={e=>setSub(e.target.value)} maxLength={80}/><datalist id="budget-sub">{TAXONOMY[group].map(c=><option key={c} value={c}/>)}</datalist></label>}
    <label>Monthly budget (Rp)<div className="amount-input-wrap"><span>Rp</span><input autoFocus type="number" inputMode="numeric" min="0" step="1000" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></div></label>
    <label>Note <span className="optional">(optional)</span><input maxLength={300} value={note} onChange={e=>setNote(e.target.value)}/></label>
    {error&&<div className="feedback error" role="alert">{error}</div>}
    <button className="btn btn-primary full" disabled={saving||amount===''||Number(amount)<0}>{saving?'Saving...':'Save budget'}<Check size={17}/></button>
    {existing&&<button type="button" className="btn btn-outline full" onClick={remove}><Trash2 size={16}/> Delete this line</button>}
  </form></Sheet>;
}

function TransactionItem({tx,byId,userId,hidden,onEdit,onDelete}) {
  const account=byId[tx.account_id], to=tx.to_account_id?byId[tx.to_account_id]:null;
  const from=account?.name||'Partner\'s private account';
  const label=labelFor(tx);
  const sign=tx.kind==='income'?'+':tx.kind==='expense'?'−':'';
  const amountClass=tx.kind==='income'?'is-positive':tx.kind==='transfer'?'is-neutral':'';
  return <article className="transaction-item"><div className={`category-icon ${tx.kind==='income'?'category-income':tx.kind==='transfer'?'category-transfer':tx.category==='Tabungan'?'category-saving':''}`} aria-hidden="true">{iconFor(tx)}</div><div className="transaction-description"><strong>{label}{tx.kind==='expense'&&<span className="group-chip">{tx.category}</span>}</strong><span>{tx.note||(tx.kind==='transfer'?'Balance transfer':tx.kind==='income'?'Income':tx.category)}</span><small>{dateLabel(tx.occurred_on)} <span className="middot">·</span> {account?.visibility==='shared'?<Users size={11}/>:<LockKeyhole size={11}/>} {tx.kind==='transfer'?`${from} → ${to?.name||'outside'}`:from}{tx.source==='gmail'&&<span className="source-chip"><Mail size={10}/> Gmail</span>}</small></div><div className="transaction-side"><strong className={amountClass}>{hidden?'••••••':`${sign}${number(tx.amount)}`}</strong>{tx.created_by===userId&&<div className="tx-actions"><IconButton label={`Edit transaction ${label}`} onClick={()=>onEdit(tx)}><Pencil size={15}/></IconButton><IconButton label={`Delete transaction ${label}`} onClick={()=>onDelete(tx)}><Trash2 size={15}/></IconButton></div>}</div></article>;
}
function TransactionList({items,accounts,userId,hidden,onEdit,onDelete,emptyAction}) {
  const byId=Object.fromEntries(accounts.map(a=>[a.id,a]));
  if(!items.length)return <EmptyState title="No transactions yet" description="Start with something small today — everything will be neatly tracked here." action={emptyAction?'Add transaction':undefined} onAction={emptyAction}/>;
  return <div className="transaction-list">{items.map(t=><TransactionItem key={t.id} tx={t} byId={byId} userId={userId} hidden={hidden} onEdit={onEdit} onDelete={onDelete}/>)}</div>;
}
function InboxList({items,hidden,onApprove,onReject}) {
  if(!items.length)return <EmptyState icon={Inbox} title="All caught up" description="Gmail transactions with a clear category are recorded automatically. Anything uncertain shows up here."/>;
  return <div className="transaction-list">{items.map(it=><article className="transaction-item inbox-item" key={it.id}><div className="category-icon category-inbox" aria-hidden="true"><Mail size={19}/></div><div className="transaction-description"><strong>{it.merchant||it.subject||it.sender}</strong><span>{it.subcategory?`Suggested: ${it.category} · ${it.subcategory}`:'Category unknown'}{it.account_hint?` · ${it.account_hint}`:''}</span><small>{dateLabel(it.occurred_on)} <span className="middot">·</span> {it.reason||it.sender}</small></div><div className="transaction-side"><strong className={it.kind==='income'?'is-positive':''}>{it.amount==null?'Rp ?':hidden?'••••••':number(it.amount)}</strong><div className="inbox-actions"><button className="btn btn-soft btn-small" onClick={()=>onApprove(it)}><Check size={14}/> Review</button><IconButton label="Dismiss this email" onClick={()=>onReject(it)}><X size={15}/></IconButton></div></div></article>)}</div>;
}
function InsightGraph({data,hidden}){
  return <section className="surface panel-graph"><div className="panel-heading"><div><span className="eyebrow">OVERVIEW</span><h3>6-month cash flow</h3></div><div className="graph-legend"><span><i className="dot dot-mint"/>Income</span><span><i className="dot dot-blue"/>Spending</span></div></div>{hidden?<div className="masked-graph"><EyeOff size={24}/><span>Chart hidden</span></div>:<div className="graph-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{top:14,right:0,left:-20,bottom:0}} barGap={6}><CartesianGrid stroke="#f1e7e4" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fill:'#85919d',fontSize:12}} dy={9}/><YAxis tickLine={false} axisLine={false} tick={{fill:'#98a4ae',fontSize:11}} tickFormatter={compact}/><Tooltip formatter={number} contentStyle={{borderRadius:14,border:'1px solid #e9edf0',boxShadow:'0 14px 30px #3a184620'}}/><Bar dataKey="pemasukan" name="Income" fill="#f59e42" radius={[6,6,0,0]} maxBarSize={30}/><Bar dataKey="pengeluaran" name="Spending" fill="#7b5ea7" radius={[6,6,0,0]} maxBarSize={30}/></BarChart></ResponsiveContainer></div>}</section>;
}
function CategoryGraph({data,expense,hidden}) {
  return <section className="surface panel-categories"><div className="panel-heading"><div><span className="eyebrow">SPENDING</span><h3>Where did the money go?</h3></div></div>{!data.length?<EmptyState icon={BarChart3} title="No spending yet" description="Categories will appear once you record an expense."/>:hidden?<div className="masked-graph"><EyeOff size={24}/><span>Details hidden</span></div>:<><div className="donut-area"><ResponsiveContainer width="100%" height={204}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={66} outerRadius={89} paddingAngle={3} stroke="none">{data.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Pie><Tooltip formatter={number}/></PieChart></ResponsiveContainer><div className="donut-center"><span>This month</span><strong>{compact(expense)}</strong></div></div><div className="category-legend">{data.slice(0,4).map((d,i)=><div key={d.name}><span><i className="dot" style={{background:PALETTE[i%PALETTE.length]}}/>{d.name}</span><strong>{number(d.value)}</strong></div>)}</div></>}</section>;
}


// ---------- Dashboard per kategori ----------
const totalsFromTx=txs=>{const map={};txs.forEach(t=>{const k=[t.occurred_on.slice(0,7),t.kind,t.category,t.subcategory||''].join('|');map[k]=(map[k]||0)+Number(t.amount)});return Object.entries(map).map(([k,total])=>{const [month,kind,category,subcategory]=k.split('|');return {month,kind,category,subcategory,total}})};
function CategoryBreakdown({transactions,ownedIds,month,hidden,fetchTotals,dataVersion,onOpen}){
  const [source,setSource]=useState('view'),[familyRows,setFamilyRows]=useState(null);
  useEffect(()=>{if(source!=='family')return;let alive=true;setFamilyRows(null);const y=Number(month.slice(0,4));const years=Number(month.slice(5,7))<6?[y-1,y]:[y];Promise.all(years.map(fetchTotals)).then(r=>{if(alive)setFamilyRows(r.flat())}).catch(()=>{if(alive)setFamilyRows([])});return()=>{alive=false}},[source,month,fetchTotals,dataVersion]);
  const rows=useMemo(()=>source==='view'?totalsFromTx(transactions.filter(t=>t.kind==='expense'&&ownedIds.has(t.account_id))):(familyRows||[]).filter(r=>r.kind==='expense'),[source,transactions,ownedIds,familyRows]);
  const months=Array.from({length:6},(_,i)=>shiftMonth(month,i-5)),prev=shiftMonth(month,-1);
  const groups=EXPENSE_GROUPS.map(g=>{
    const subs={};rows.filter(r=>r.category===g&&months.includes(r.month)).forEach(r=>{const k=r.subcategory||'(no subcategory)';subs[k]=subs[k]||{name:k,trend:months.map(()=>0)};subs[k].trend[months.indexOf(r.month)]+=Number(r.total)});
    const items=Object.values(subs).map(x=>({...x,cur:x.trend[5],prev:x.trend[4],avg:sum(x.trend.slice(0,5))/5})).sort((a,b)=>b.cur-a.cur||b.avg-a.avg);
    return {name:g,items,total:sum(items,i=>i.cur),prevTotal:sum(items,i=>i.prev)};
  });
  const spend=sum(groups.filter(g=>g.name!=='Tabungan'),g=>g.total);
  const loading=source==='family'&&familyRows===null;
  const money=v=>hidden?'•••':number(v);
  const delta=(cur,old)=>{if(!old&&!cur)return null;if(!old)return <span className="delta up">new</span>;const p=(cur-old)/old;if(Math.abs(p)<0.005)return <span className="delta flat">same</span>;return <span className={`delta ${p>0?'up':'down'}`}>{p>0?'▲':'▼'} {Math.abs(Math.round(p*100))}%</span>};
  return <section className="surface breakdown"><div className="panel-heading"><div><span className="eyebrow">INSIGHTS · {monthLabel(month).toUpperCase()}</span><h3>Spending by category</h3></div></div>
    <div className="breakdown-toolbar"><Segmented label="Data source" value={source} onChange={setSource} options={[{value:'view',label:'Visible accounts'},{value:'family',label:'Whole family'}]}/><small>vs {monthLabel(prev)} · 6-month trend</small></div>
    {loading?<div className="masked-graph"><RefreshCw size={22} className="spinning"/><span>Loading family data...</span></div>:
    groups.every(g=>!g.items.length)?<EmptyState icon={BarChart3} title="No spending yet" description="Category details appear once there are expenses in the last 6 months."/>:
    groups.filter(g=>g.items.length).map(g=>{const max=Math.max(1,...g.items.map(i=>i.cur));return <div className="breakdown-group" key={g.name}>
      <div className="breakdown-group-head"><span className={`group-dot g-${g.name.toLowerCase()}`}/><strong>{g.name}</strong>{g.name!=='Tabungan'&&spend>0&&<em>{Math.round(g.total/spend*100)}% of spending</em>}<span className="breakdown-total">{money(g.total)}</span>{delta(g.total,g.prevTotal)}</div>
      {g.items.map(it=>{const tmax=Math.max(1,...it.trend);return <button className="breakdown-row" key={it.name} onClick={()=>onOpen(g.name,it.name)}>
        <span className="breakdown-icon" aria-hidden="true">{iconFor({kind:'expense',category:g.name,subcategory:it.name})}</span>
        <span className="breakdown-main"><span className="breakdown-line"><strong>{it.name}</strong><span>{money(it.cur)}</span></span>
          <span className="breakdown-bar"><i className={`g-${g.name.toLowerCase()}`} style={{width:`${it.cur/max*100}%`}}/></span>
          <span className="breakdown-meta">{delta(it.cur,it.prev)}<span>avg {hidden?'•••':compact(it.avg)}/mo</span><span className="spark" aria-label="6-month trend">{it.trend.map((v,i)=><i key={i} className={i===5?'now':''} style={{height:`${Math.max(8,v/tmax*100)}%`}}/>)}</span></span></span></button>})}
    </div>})}
    {source==='family'&&<p className="tiny-note breakdown-note">Whole family uses shared accounts, all your private accounts, and your partner's private totals if they've chosen to share them.</p>}
  </section>;
}

// ---------- Weekly review ----------
const isoDay=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays=(iso,n)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return isoDay(d)};
const daysBetween=(a,b)=>Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/864e5);
function periodStats(txs,from,to){const w=txs.filter(t=>t.occurred_on>=from&&t.occurred_on<=to);return {list:w,income:sum(w.filter(isRealIncome),t=>t.amount),spend:sum(w.filter(isSpending),t=>t.amount),saved:sum(w.filter(isSaving),t=>t.amount)}}
function WeeklyReview({transactions,accounts,budgets,assets,inbox,hidden,onClose,onLater,onDone,onUpdateAssets,onReviewGmail}){
  const today=dateToday(), from=addDays(today,-6), prevFrom=addDays(today,-13), prevTo=addDays(today,-7);
  const ids=new Set(accounts.map(a=>a.id));
  const visible=transactions.filter(t=>ids.has(t.account_id));
  const cur=periodStats(visible,from,today), prev=periodStats(visible,prevFrom,prevTo);
  const money=v=>hidden?'•••':number(v);
  const delta=(a,b,goodWhenDown)=>{if(!b)return null;const p=(a-b)/b;if(Math.abs(p)<0.005)return <span className="delta flat">same</span>;const up=p>0;return <span className={`delta ${up===!goodWhenDown?'down':'up'}`}>{up?'▲':'▼'} {Math.abs(Math.round(p*100))}% vs last week</span>};
  const byCat={};cur.list.filter(isSpending).forEach(t=>{const k=t.subcategory||t.category;byCat[k]=byCat[k]||{name:k,group:t.category,total:0,count:0};byCat[k].total+=Number(t.amount);byCat[k].count++});
  const topCats=Object.values(byCat).sort((a,b)=>b.total-a.total).slice(0,5);
  const topTx=cur.list.filter(isSpending).sort((a,b)=>b.amount-a.amount).slice(0,3);
  const month=today.slice(0,7), year=Number(today.slice(0,4));
  const bv=buildBudget(budgets,totalsFromTx(visible),year,month);
  const spendGroups=bv.groups.filter(g=>g.name!=='Tabungan');
  const monthBudget=sum(spendGroups,g=>g.budget), monthSpent=sum(spendGroups,g=>g.actual);
  const dim=new Date(year,Number(today.slice(5,7)),0).getDate(), elapsed=Number(today.slice(8))/dim;
  const pace=monthBudget>0?monthSpent/monthBudget:null;
  const banks=accounts.filter(a=>a.kind!=='credit').map(a=>({a,bal:getBalance(a,transactions),chg:sum(transactions.filter(t=>t.occurred_on>=from&&t.occurred_on<=today),t=>txDelta(t,a.id))}));
  const cards=accounts.filter(a=>a.kind==='credit').map(a=>{const limit=Number(a.credit_limit||0),avail=limit+getBalance(a,transactions);return {a,limit,avail,used:limit>0?(limit-avail)/limit:0}});
  const {rows}=assetSeries(assets||[]);const lastAsset=rows[rows.length-1];const assetDays=lastAsset?daysBetween(lastAsset.date,today):null;
  const alerts=[...banks.filter(b=>b.bal<0).map(b=>`${b.a.name} balance is negative`),...cards.filter(c=>c.used>=0.7).map(c=>`${c.a.name} is ${Math.round(c.used*100)}% used`),...(pace!=null&&pace>elapsed+0.1?[`Spending is ahead of budget pace (${Math.round(pace*100)}% used, ${Math.round(elapsed*100)}% of the month gone)`]:[])];
  const range=`${dateLabel(from)} – ${dateLabel(today)}`;
  return <Sheet title="Weekly review" onClose={onClose}><div className="weekly">
    <p className="weekly-range"><CalendarDays size={15}/> {range}</p>
    {alerts.length>0&&<div className="weekly-alerts">{alerts.map(x=><div key={x}><CircleHelp size={15}/> {x}</div>)}</div>}
    <section className="weekly-block"><h4>This week</h4><div className="weekly-stats">
      <div><span>Spending</span><strong>{money(cur.spend)}</strong>{delta(cur.spend,prev.spend,true)}</div>
      <div><span>Income</span><strong>{money(cur.income)}</strong></div>
      <div><span>Saved</span><strong>{money(cur.saved)}</strong></div>
      <div><span>Transactions</span><strong>{cur.list.length}</strong></div></div></section>
    {topCats.length>0&&<section className="weekly-block"><h4>Where it went</h4>{topCats.map(c=><div className="weekly-row" key={c.name}><span>{iconFor({kind:'expense',category:c.group,subcategory:c.name})} {c.name} <em>· {c.count}×</em></span><strong>{money(c.total)}</strong></div>)}</section>}
    {topTx.length>0&&<section className="weekly-block"><h4>Biggest expenses</h4>{topTx.map(t=><div className="weekly-row" key={t.id}><span>{labelFor(t)}{t.note?` — ${t.note}`:''} <em>· {dateLabel(t.occurred_on)}</em></span><strong>{money(t.amount)}</strong></div>)}</section>}
    {pace!=null&&<section className="weekly-block"><h4>Budget pace · {monthLabel(month)}</h4><ProgressLine budget={monthBudget} actual={monthSpent} hidden={hidden}/><p className="weekly-note">{Math.round(elapsed*100)}% of the month has passed. {pace<=elapsed?'You\'re on track 👍':'Spending is running ahead — worth slowing down a bit.'}</p></section>}
    <section className="weekly-block"><h4>Accounts</h4>
      {banks.map(({a,bal,chg})=><div className="weekly-row" key={a.id}><span><Wallet size={14}/> {a.name}{chg!==0&&<em className={chg>0?'pos':'neg'}> {chg>0?'+':'−'}{hidden?'•••':number(Math.abs(chg))} this week</em>}</span><strong className={bal<0?'is-over':''}>{money(bal)}</strong></div>)}
      {cards.map(({a,limit,avail,used})=><div className="weekly-row" key={a.id}><span><CreditCard size={14}/> {a.name} <em>· {Math.round(used*100)}% of {hidden?'•••':compact(limit)} used</em></span><strong>{money(avail)} <em>avail.</em></strong></div>)}
      {!banks.length&&!cards.length&&<p className="weekly-note">No accounts yet.</p>}
    </section>
    <section className="weekly-block"><h4>Savings & investments</h4>
      {lastAsset?<div className="weekly-row"><span><PiggyBank size={14}/> Total assets <em>· updated {dateLabel(lastAsset.date)}</em></span><strong>{money(lastAsset.Total)}</strong></div>:<p className="weekly-note">No asset values yet.</p>}
      {(assetDays==null||assetDays>=7)&&<button className="btn btn-soft full" onClick={onUpdateAssets}><RefreshCw size={15}/> Update investment values</button>}
    </section>
    {inbox.length>0&&<button className="review-banner" onClick={onReviewGmail}><Mail size={18}/><span><strong>{inbox.length} Gmail transaction{inbox.length>1?'s':''}</strong> still need review</span><ArrowRight size={16}/></button>}
    <div className="weekly-actions"><button className="btn btn-outline" onClick={onLater}>Remind me later</button><button className="btn btn-primary" onClick={onDone}><Check size={16}/> Done for this week</button></div>
  </div></Sheet>;
}

function Dashboard({user,accounts,allAccounts,transactions,scope,month,hidden,setHidden,onPage,onNew,onEdit,onDelete,pendingCount,onReview,fetchTotals,dataVersion,onOpenCategory,onWeekly}) {
  const ids=useMemo(()=>new Set(accounts.map(x=>x.id)),[accounts]);
  // Transaksi milik rekening yang sedang ditampilkan (sumber) — dipakai untuk pemasukan/pengeluaran.
  const ownedTx=useMemo(()=>transactions.filter(t=>ids.has(t.account_id)),[transactions,ids]);
  const current=ownedTx.filter(t=>t.occurred_on.startsWith(month));
  const income=sum(current.filter(isRealIncome),t=>t.amount);
  const expense=sum(current.filter(isSpending),t=>t.amount);
  const saving=sum(current.filter(isSaving),t=>t.amount);
  const balance=sum(accounts.filter(a=>a.kind!=='credit'),a=>getBalance(a,transactions));
  const ccDebt=sum(accounts.filter(a=>a.kind==='credit'),a=>Math.max(0,-getBalance(a,transactions)));
  const graph=Array.from({length:6},(_,i)=>{const m=shiftMonth(month,i-5);const slice=ownedTx.filter(t=>t.occurred_on.startsWith(m));return {label:shortMonth(m),pemasukan:sum(slice.filter(isRealIncome),t=>t.amount),pengeluaran:sum(slice.filter(isSpending),t=>t.amount)}});
  const categoryData=Object.entries(current.filter(isSpending).reduce((a,t)=>({...a,[t.subcategory||t.category]:(a[t.subcategory||t.category]||0)+Number(t.amount)}),{})).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  return <div className="page-stack"><div className="dashboard-head"><div><span className="eyebrow">MONEY OVERVIEW</span><h2>Our money, in order <span className="inline-heart">♡</span></h2><p>Manage today, for the big plans ahead.</p></div><button className="welcome-badge weekly-btn" onClick={onWeekly}><CalendarDays size={14}/> Weekly review</button></div>
    <section className="balance-hero"><div className="balance-orbit orbit-one"/><div className="balance-orbit orbit-two"/><div className="balance-hero-top"><span><Wallet size={18}/> Total balance you can see</span><IconButton label={hidden?'Show amounts':'Hide amounts'} onClick={()=>setHidden(!hidden)} className="hero-eye">{hidden?<EyeOff size={20}/>:<Eye size={20}/>}</IconButton></div><div className="balance-value">{formatValue(balance,hidden)}</div><div className="balance-hero-foot"><span><span className="glow-dot"/> {scopeText[scope]}</span><span>{ccDebt>0?`Credit card bill ${hidden?'•••':number(ccDebt)}`:'Current balance, all accounts'}</span></div></section>
    {pendingCount>0&&<button className="review-banner" onClick={onReview}><Mail size={18}/><span><strong>{pendingCount} Gmail transaction{pendingCount>1?'s':''}</strong> waiting for your review</span><ArrowRight size={16}/></button>}
    <div className="summary-grid four"><div className="summary-card"><div className="summary-icon income-icon"><ArrowDownLeft size={20}/></div><div><span>Income</span><strong>{formatValue(income,hidden)}</strong><small><TrendingUp size={13}/> Excl. transfers & asset sales</small></div></div><div className="summary-card"><div className="summary-icon expense-icon"><ArrowUpRight size={20}/></div><div><span>Spending</span><strong>{formatValue(expense,hidden)}</strong><small><TrendingDown size={13}/> Kebutuhan + Keinginan</small></div></div><div className="summary-card"><div className="summary-icon saving-icon"><PiggyBank size={20}/></div><div><span>Saved</span><strong>{formatValue(saving,hidden)}</strong><small><PiggyBank size={13}/> Tabungan category</small></div></div><div className="summary-card"><div className="summary-icon net-icon"><BarChart3 size={20}/></div><div><span>Left over</span><strong>{formatValue(income-expense-saving,hidden)}</strong><small>Income − spending − saved</small></div></div></div>
    {accounts.length===0&&<div className="start-card"><div><span className="eyebrow">START HERE</span><h3>No accounts yet.</h3><p>Add a shared or private account, then record your first transaction.</p></div><button className="btn btn-primary" onClick={()=>onNew('account')}><Plus size={17}/> Add account</button></div>}
    <div className="insights-grid"><InsightGraph data={graph} hidden={hidden}/><CategoryGraph data={categoryData} expense={expense} hidden={hidden}/></div>
    <CategoryBreakdown transactions={transactions} ownedIds={ids} month={month} hidden={hidden} fetchTotals={fetchTotals} dataVersion={dataVersion} onOpen={onOpenCategory}/>
    <section className="surface recent-section"><div className="panel-heading"><div><span className="eyebrow">ACTIVITY</span><h3>Recent transactions</h3></div><button className="link-button view-all" onClick={()=>onPage('transactions')}>See all <ArrowRight size={16}/></button></div><TransactionList items={transactions.filter(t=>(ids.has(t.account_id)||ids.has(t.to_account_id))&&t.occurred_on.startsWith(month)).slice(0,5)} accounts={allAccounts||accounts} userId={user.id} hidden={hidden} onEdit={onEdit} onDelete={onDelete} emptyAction={accounts.length?()=>onNew('transaction'):undefined}/></section>
  </div>;
}
const GROUP_FILTERS=[{value:'all',label:'All categories'},{value:'Kebutuhan',label:'Kebutuhan'},{value:'Keinginan',label:'Keinginan'},{value:'Tabungan',label:'Tabungan'},{value:'Pemasukan',label:'Pemasukan'},{value:'Transfer',label:'Transfer'}];
function TransactionsPage({items,accounts,userId,hidden,onEdit,onDelete,onNew,inbox,onApproveInbox,onRejectInbox,tab,setTab,preset,month}){
  const [search,setSearch]=useState(''),[kind,setKind]=useState('all'),[fMonth,setFMonth]=useState(month),[group,setGroup]=useState('all'),[sub,setSub]=useState('all'),[showFilter,setShowFilter]=useState(false);
  useEffect(()=>{setFMonth(month)},[month]);
  useEffect(()=>{if(preset){setGroup(preset.group||'all');setSub(preset.sub||'all');setKind('all');setSearch('');if(preset.month)setFMonth(preset.month)}},[preset]);
  const byId=useMemo(()=>Object.fromEntries(accounts.map(a=>[a.id,a])),[accounts]);
  const monthOptions=useMemo(()=>[...new Set([month,...items.map(t=>t.occurred_on.slice(0,7))])].sort().reverse(),[items,month]);
  const inMonthGroup=useMemo(()=>items.filter(t=>(fMonth==='all'||t.occurred_on.startsWith(fMonth))&&(group==='all'||t.category===group)),[items,fMonth,group]);
  const subOptions=useMemo(()=>[...new Set(inMonthGroup.map(t=>t.subcategory).filter(Boolean))].sort(),[inMonthGroup]);
  const shown=useMemo(()=>inMonthGroup.filter(t=>(sub==='all'||t.subcategory===sub)&&(kind==='all'||t.kind===kind)&&(`${t.category} ${t.subcategory||''} ${t.note||''} ${byId[t.account_id]?.name||''}`).toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))),[inMonthGroup,sub,kind,search,byId]);
  const total=sum(shown.filter(t=>t.kind!=='transfer'),t=>(t.kind==='income'?1:-1)*Number(t.amount));
  const active=(fMonth!==month?1:0)+(group!=='all'?1:0)+(sub!=='all'?1:0)+(kind!=='all'?1:0);
  const reset=()=>{setFMonth(month);setGroup('all');setSub('all');setKind('all');setSearch('')};
  return <section className="surface transaction-page"><div className="panel-heading"><div><span className="eyebrow">HISTORY</span><h3>{tab==='review'?'Needs review':'Transactions'} <span className="count-pill">{tab==='review'?inbox.length:shown.length}</span></h3></div><button className="btn btn-primary desktop-new" onClick={()=>onNew('transaction')} disabled={!accounts.length}><Plus size={16}/> Transaction</button></div>
    <div className="tab-row"><Segmented label="Transaction view" value={tab} onChange={setTab} options={[{value:'history',label:'History'},{value:'review',label:`Needs review${inbox.length?` (${inbox.length})`:''}`}]}/></div>
    {tab==='review'?<InboxList items={inbox} hidden={hidden} onApprove={onApproveInbox} onReject={onRejectInbox}/>:<>
    <div className="filter-bar">
      <div className="search-field"><Search size={18}/><input aria-label="Search transactions" placeholder="Search notes, merchants, accounts..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <button className={`btn btn-outline filter-toggle ${active?'has-active':''}`} onClick={()=>setShowFilter(v=>!v)}><Settings2 size={16}/> Filter{active?` (${active})`:''}</button>
    </div>
    {(showFilter||active>0)&&<div className="filter-panel">
      <label>Month<select value={fMonth} onChange={e=>setFMonth(e.target.value)}><option value="all">All months</option>{monthOptions.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
      <label>Category<select value={group} onChange={e=>{setGroup(e.target.value);setSub('all')}}>{GROUP_FILTERS.map(g=><option key={g.value} value={g.value}>{g.label}</option>)}</select></label>
      <label>Subcategory<select value={sub} onChange={e=>setSub(e.target.value)} disabled={!subOptions.length}><option value="all">All subcategories</option>{subOptions.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      <label>Type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All types</option><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select></label>
      {active>0&&<button type="button" className="link-button filter-reset" onClick={reset}><X size={14}/> Clear filters</button>}
    </div>}
    {shown.length>0&&<div className="filter-summary"><span>{shown.length} transaction{shown.length>1?'s':''} · {fMonth==='all'?'all months':monthLabel(fMonth)}{group!=='all'?` · ${group}`:''}{sub!=='all'?` · ${sub}`:''}</span><strong className={total>=0?'is-positive':''}>{hidden?'•••':`${total<0?'−':'+'}${number(Math.abs(total))}`}</strong></div>}
    {shown.length?<TransactionList items={shown} accounts={accounts} userId={userId} hidden={hidden} onEdit={onEdit} onDelete={onDelete}/>:<EmptyState icon={Search} title="No matching transactions" description="Try a different month, category, or search term." action={active?'Clear filters':undefined} onAction={reset}/>}</>}</section>;
}

// ---------- Budget ----------
const pctClass=p=>p>1?'over':p>=0.8?'warn':'ok';
function ProgressLine({budget,actual,hidden}){
  const p=budget>0?actual/budget:actual>0?2:0;
  return <div className="budget-progress"><div className={`budget-bar ${pctClass(p)}`}><i style={{width:`${Math.min(100,p*100)}%`}}/></div><div className="budget-numbers"><span>{hidden?'•••':number(actual)} <em>of {hidden?'•••':number(budget)}</em></span><strong className={pctClass(p)}>{budget>0?`${Math.round(p*100)}%`:actual>0?'no budget':'—'}</strong></div></div>;
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
    if(!groupRow){const extra={};expense.filter(t=>t.month===month&&t.category===g&&!known.has(t.subcategory)).forEach(t=>{extra[t.subcategory||'(no subcategory)']=(extra[t.subcategory||'(no subcategory)']||0)+Number(t.total)});Object.entries(extra).forEach(([name,actual])=>lines.push({row:null,name,budget:0,actual}))}
    const budget=groupRow?Number(groupRow.monthly_amount):sum(subRows,r=>r.monthly_amount);
    return {name:g,groupRow,lines,budget,actual:actualOf(t=>t.category===g,month),ytdBudget:budget*monthIdx,ytdActual:actualOf(t=>t.category===g)};
  });
  const income=sum(totals.filter(t=>t.month===month&&t.kind==='income'&&!INTERNAL_INCOME.includes(t.subcategory)),t=>t.total);
  return {groups,income,budget:sum(groups,g=>g.budget),actual:sum(groups,g=>g.actual),hasBudget:budgets.some(b=>b.year===year)};
}
function BudgetPage({budgets,fetchTotals,dataVersion,month,hidden,shareInfo,onEditBudget,onNewBudget}){
  const year=Number(month.slice(0,4));
  const [totals,setTotals]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;setError('');fetchTotals(year).then(r=>{if(alive)setTotals(r||[])}).catch(e=>{if(alive){setError(e.message||'Couldn\'t load budget actuals.');setTotals([])}});return()=>{alive=false}},[year,fetchTotals,dataVersion]);
  const view=useMemo(()=>totals?buildBudget(budgets,totals,year,month):null,[budgets,totals,year,month]);
  if(!view)return <section className="surface"><div className="masked-graph"><RefreshCw size={22} className="spinning"/><span>Calculating budget actuals...</span></div></section>;
  const remaining=view.budget-view.actual;
  return <div className="page-stack">
    <div className="page-intro"><div><span className="eyebrow">BUDGET {year}</span><h2>Plan vs actual</h2><p>{monthLabel(month)} · Budggt categories.</p></div><button className="btn btn-primary desktop-new" onClick={onNewBudget}><Plus size={17}/> Budget line</button></div>
    {error&&<div className="feedback error" role="alert">{error}</div>}
    {!view.hasBudget?<section className="surface"><EmptyState icon={Target} title={`No budget for ${year} yet`} description="Run seed_budget_2027.sql in Supabase, or add budget lines one by one." action="Add budget line" onAction={onNewBudget}/></section>:<>
    <div className="summary-grid four"><div className="summary-card"><div className="summary-icon net-icon"><Target size={20}/></div><div><span>Total budget</span><strong>{formatValue(view.budget,hidden)}</strong><small>Includes savings</small></div></div><div className="summary-card"><div className="summary-icon expense-icon"><ArrowUpRight size={20}/></div><div><span>Used</span><strong>{formatValue(view.actual,hidden)}</strong><small>{view.budget?`${Math.round(view.actual/view.budget*100)}% of budget`:'—'}</small></div></div><div className="summary-card"><div className="summary-icon saving-icon"><PiggyBank size={20}/></div><div><span>Remaining</span><strong className={remaining<0?'is-over':''}>{formatValue(remaining,hidden)}</strong><small>{remaining<0?'Over budget':'On track'}</small></div></div><div className="summary-card"><div className="summary-icon income-icon"><ArrowDownLeft size={20}/></div><div><span>Income recorded</span><strong>{formatValue(view.income,hidden)}</strong><small>This month</small></div></div></div>
    {view.groups.map(g=><section className="surface budget-group" key={g.name}><div className="panel-heading"><div><span className="eyebrow">{g.name.toUpperCase()}</span><h3>{formatValue(g.budget,hidden)} <small className="muted-inline">/ month</small></h3></div>{g.groupRow&&<IconButton label={`Edit budget ${g.name}`} onClick={()=>onEditBudget(g.groupRow)}><Pencil size={16}/></IconButton>}</div>
      <ProgressLine budget={g.budget} actual={g.actual} hidden={hidden}/>
      {g.groupRow?.note&&<p className="budget-note">{g.groupRow.note}</p>}
      {g.lines.length>0&&<div className="budget-lines">{g.lines.map(l=><button className="budget-line" key={l.name} onClick={()=>l.row?onEditBudget(l.row):onNewBudget()}><span className="budget-line-name">{l.name}{!l.row&&<em> · not budgeted</em>}</span><ProgressLine budget={l.budget} actual={l.actual} hidden={hidden}/></button>)}</div>}
      <div className="budget-ytd">Year to date (Jan–{monthLabel(month).split(' ')[0]}): {hidden?'•••':number(g.ytdActual)} of {hidden?'•••':number(g.ytdBudget)}</div>
    </section>)}</>}
    <p className="tiny-note budget-privacy"><ShieldCheck size={14}/> {shareInfo}</p>
  </div>;
}
function AccountTile({a,balance,userId,hidden,onEdit,onDelete}){
  const credit=a.kind==='credit', limit=Number(a.credit_limit||0), avail=limit+balance, usedPct=limit>0?Math.min(1,Math.max(0,(limit-avail)/limit)):0;
  return <article className={`account-tile ${credit?'credit-tile':''}`}><div className="account-tile-top"><span className="account-symbol">{credit?<CreditCard size={21}/>:<Wallet size={21}/>}</span><span className={`privacy-tag ${a.visibility==='shared'?'shared':'private'}`}>{a.visibility==='shared'?<Users size={12}/>:<LockKeyhole size={12}/>} {a.visibility==='shared'?'Shared':'Private'}</span></div><h4>{a.name}</h4>
    {credit?<><p>Available limit</p><strong className={avail<0?'is-over':''}>{formatValue(avail,hidden)}</strong><div className="credit-bar"><i style={{width:`${usedPct*100}%`}}/></div><p className="credit-meta">Limit {hidden?'•••':number(limit)} · used {hidden?'•••':number(Math.max(0,limit-avail))}</p></>
      :<><p>Current balance</p><strong>{formatValue(balance,hidden)}</strong></>}
    <div className="account-tile-bottom"><small>{a.owner_id===userId?'Added by you':'Added by your partner'}</small>{a.owner_id===userId&&<div><IconButton label={`Edit account ${a.name}`} onClick={()=>onEdit(a)}><Pencil size={16}/></IconButton><IconButton label={`Delete account ${a.name}`} onClick={()=>onDelete(a)}><Trash2 size={16}/></IconButton></div>}</div></article>;
}
function AccountsPage({accounts,transactions,userId,hidden,onEdit,onDelete,onNew,assets,onUpdateAssets,onEditAsset,goals,budgets,onNewGoal,onEditGoal,onDepositGoal}){
  const groups=[{key:'shared',title:'Shared accounts',desc:'Visible to you and your partner',Icon:Users,match:a=>a.kind!=='credit'&&a.visibility==='shared'},{key:'private',title:'My private accounts',desc:'Only visible to you',Icon:LockKeyhole,match:a=>a.kind!=='credit'&&a.visibility==='private'},{key:'credit',title:'Credit cards',desc:'Showing available limit',Icon:CreditCard,match:a=>a.kind==='credit'}];
  return <div className="page-stack"><div className="page-intro"><div><span className="eyebrow">ACCOUNTS & ASSETS</span><h2>All your money, one place.</h2><p>Account balances, credit card limits, and how your savings are growing.</p></div><button className="btn btn-primary desktop-new" onClick={()=>onNew('account')}><Plus size={17}/> Add account</button></div>
    <AssetSection assets={assets} hidden={hidden} onUpdate={onUpdateAssets} onEdit={onEditAsset}/>
    <GoalsSection goals={goals} budgets={budgets} assets={assets} hidden={hidden} onNew={onNewGoal} onEdit={onEditGoal} onDeposit={onDepositGoal} onUpdateAssets={onUpdateAssets}/>
    {groups.map(g=>{const entries=accounts.filter(g.match);if(g.key==='credit'&&!entries.length)return null;return <section key={g.key} className="account-section"><div className="account-section-title"><div className={`account-group-icon ${g.key}`}><g.Icon size={18}/></div><div><h3>{g.title} <span className="count-pill">{entries.length}</span></h3><p>{g.desc}</p></div></div>{entries.length?<div className="account-grid">{entries.map(a=><AccountTile key={a.id} a={a} balance={getBalance(a,transactions)} userId={userId} hidden={hidden} onEdit={onEdit} onDelete={onDelete}/>)}</div>:<div className="group-empty">No {g.key==='shared'?'shared':'private'} accounts yet.</div>}</section>})}
    <button className="btn btn-soft full mobile-only-add" onClick={()=>onNew('account')}><Plus size={17}/> Add account / credit card</button>
  </div>;
}

// ---------- Tabungan: catatan nilai aset ----------
const DEFAULT_PLATFORMS=['Bibit','GORO','Stockbit','Gotrade'];
const ASSET_COLORS={Bibit:'#f2643c',Gotrade:'#7b5ea7',GORO:'#f7a541',Stockbit:'#e0457b'};
const assetColor=(p,i)=>ASSET_COLORS[p]||PALETTE[(i+3)%PALETTE.length];
function assetSeries(assets){
  const platforms=[...new Set([...DEFAULT_PLATFORMS.filter(p=>assets.some(a=>a.platform===p)),...assets.map(a=>a.platform)])];
  const dates=[...new Set(assets.map(a=>a.recorded_on))].sort();
  const last={};
  const rows=dates.map(d=>{assets.filter(a=>a.recorded_on===d).forEach(a=>{last[a.platform]=Number(a.value)});const row={date:d,label:new Date(`${d}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short'})};platforms.forEach(p=>{row[p]=last[p]??null});row.Total=sum(platforms,p=>last[p]||0);return row});
  return {platforms,rows};
}
function AssetSection({assets,hidden,onUpdate,onEdit}){
  const {platforms,rows}=useMemo(()=>assetSeries(assets),[assets]);
  const latest=p=>{const list=assets.filter(a=>a.platform===p).sort((a,b)=>b.recorded_on.localeCompare(a.recorded_on));return {cur:list[0],prev:list[1]}};
  const total=rows.length?rows[rows.length-1].Total:0, prevTotal=rows.length>1?rows[rows.length-2].Total:null;
  const lastDate=rows.length?rows[rows.length-1].date:null;
  const daysAgo=lastDate?Math.floor((new Date(`${dateToday()}T12:00:00`)-new Date(`${lastDate}T12:00:00`))/864e5):null;
  const shown=platforms.length?platforms:DEFAULT_PLATFORMS;
  const change=(cur,old)=>{if(old==null||!old)return null;const d=cur-old,p=d/old;return <span className={`delta ${d>=0?'gain':'loss'}`}>{d>=0?'▲':'▼'} {hidden?'':number(Math.abs(d))} ({(Math.abs(p)*100).toFixed(1)}%)</span>};
  return <section className="surface asset-section">
    <div className="panel-heading"><div><span className="eyebrow">SAVINGS & INVESTMENTS</span><h3>Total assets {formatValue(total,hidden)}</h3></div><button className="btn btn-primary btn-small" onClick={()=>onUpdate()}><RefreshCw size={14}/> Update values</button></div>
    <div className="asset-sub">{change(total,prevTotal)}<span>{lastDate?`Last updated ${dateLabel(lastDate)}`:'No asset values recorded yet'}</span></div>
    {daysAgo!=null&&daysAgo>=7&&<button className="review-banner asset-reminder" onClick={()=>onUpdate()}><CalendarDays size={18}/><span><strong>Time for your weekly review.</strong> It's been {daysAgo} days since the last update.</span><ArrowRight size={16}/></button>}
    <div className="asset-cards">{shown.map((p,i)=>{const {cur,prev}=latest(p);return <button key={p} className="asset-card" onClick={()=>cur?onEdit(cur):onUpdate()}><span className="asset-dot" style={{background:assetColor(p,i)}}/><span className="asset-name">{p}</span><strong>{cur?formatValue(cur.value,hidden):'—'}</strong><small>{cur?change(Number(cur.value),prev?Number(prev.value):null)||dateLabel(cur.recorded_on):'Not set yet'}</small></button>})}</div>
    {rows.length>=2?<div className="asset-chart">{hidden?<div className="masked-graph"><EyeOff size={24}/><span>Chart hidden</span></div>:<ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{top:10,right:8,left:-14,bottom:0}}><CartesianGrid stroke="#f1e7e4" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fill:'#9c8892',fontSize:11}} dy={8}/><YAxis tickLine={false} axisLine={false} tick={{fill:'#a9979f',fontSize:11}} tickFormatter={compact}/><Tooltip formatter={number} contentStyle={{borderRadius:14,border:'1px solid #f1e7e4'}}/><Legend iconType="circle" wrapperStyle={{fontSize:11}}/><Line type="monotone" dataKey="Total" stroke="#3a1846" strokeWidth={3} dot={{r:3}}/>{platforms.map((p,i)=><Line key={p} type="monotone" dataKey={p} stroke={assetColor(p,i)} strokeWidth={2} dot={false} connectNulls/>)}</LineChart></ResponsiveContainer>}</div>
      :<p className="tiny-note">The growth chart appears after at least 2 updates (e.g. this week and next week).</p>}
  </section>;
}
function AssetUpdateSheet({assets,existing,onClose,onSave,onDelete}){
  const {platforms}=assetSeries(assets);
  const list=existing?[existing.platform]:[...new Set([...DEFAULT_PLATFORMS,...platforms])];
  const lastVal=p=>{const l=assets.filter(a=>a.platform===p).sort((a,b)=>b.recorded_on.localeCompare(a.recorded_on))[0];return l?String(Number(l.value)):''};
  const [date,setDate]=useState(existing?.recorded_on||dateToday()),[values,setValues]=useState(()=>Object.fromEntries(list.map(p=>[p,existing?String(Number(existing.value)):'']))),[extra,setExtra]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const names=Object.keys(values);
  async function submit(e){e.preventDefault();const rows=names.filter(p=>values[p]!=='').map(p=>({platform:p,value:Number(values[p]),recorded_on:date}));if(!rows.length){setError('Enter at least one value.');return}setSaving(true);setError('');try{await onSave(rows);onClose()}catch(err){setError(err.message||'Couldn\'t save.')}finally{setSaving(false)}}
  async function remove(){if(!window.confirm(`Delete the ${existing.platform} entry for ${dateLabel(existing.recorded_on)}?`))return;try{await onDelete(existing);onClose()}catch(err){setError(err.message||'Couldn\'t delete.')}}
  return <Sheet title={existing?`Edit ${existing.platform}`:'Update asset values'} onClose={onClose}><form className="form sheet-form" onSubmit={submit}>
    <label>Review date<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
    {names.map(p=><label key={p}>Current value in {p} (Rp){!existing&&lastVal(p)&&<span className="optional"> · last {number(lastVal(p))}</span>}<input type="number" inputMode="numeric" min="0" step="1" value={values[p]} onChange={e=>setValues(v=>({...v,[p]:e.target.value}))} placeholder={existing?'':'Leave empty if unchanged / not checked'}/></label>)}
    {!existing&&<div className="form-pair add-platform"><label>Another platform <span className="optional">(optional)</span><input value={extra} onChange={e=>setExtra(e.target.value)} placeholder="e.g. Stockbit" maxLength={60}/></label><button type="button" className="btn btn-outline" disabled={!extra.trim()||names.includes(extra.trim())} onClick={()=>{setValues(v=>({...v,[extra.trim()]:''}));setExtra('')}}><Plus size={15}/> Add</button></div>}
    <p className="field-help"><PiggyBank size={15}/> Enter the current portfolio value in Rupiah (for Gotrade, use the IDR value or multiply by today's rate).</p>
    {error&&<div className="feedback error" role="alert">{error}</div>}
    <button className="btn btn-primary full" disabled={saving}>{saving?'Saving...':'Save values'}<Check size={17}/></button>
    {existing&&<button type="button" className="btn btn-outline full" onClick={remove}><Trash2 size={16}/> Delete this entry</button>}
  </form></Sheet>;
}
// ---------- Savings goals ----------
const INVEST_PLATFORMS=['Bibit','GORO','Stockbit','Gotrade'];
const latestAssetValues=assets=>{const m={};[...assets].sort((a,b)=>a.recorded_on.localeCompare(b.recorded_on)).forEach(a=>{m[a.platform]={value:Number(a.value),date:a.recorded_on}});return m};
const goalSources=g=>Array.isArray(g?.sources)?g.sources.filter(x=>x&&x.platform&&Number(x.share)>0):[];
const goalSaved=(g,latest)=>{const src=goalSources(g);if(!src.length)return Number(g.saved_amount||0);return sum(src,x=>(latest[x.platform]?.value||0)*Number(x.share)/100)};
const GOAL_EMOJIS=['🎯','🛟','🏝️','🗾','🏡','🏃','🎓','🚗','💍','👶','🕋','💻'];
const GOAL_SUGGESTIONS=['Emergency fund','Vietnam 2027','Japan 2028','Mandalika run 2027','Land / house','New car'];
const monthYear=iso=>new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB',{month:'short',year:'numeric'});
const durationText=m=>m==null?'—':m===0?'now':m<12?`${m} month${m>1?'s':''}`:`${Math.floor(m/12)} yr${m>=24?'s':''}${m%12?` ${m%12} mo`:''}`;
function GoalStatus({plan}){
  if(plan.status==='done')return <span className="goal-chip done">Reached 🎉</span>;
  if(plan.status==='on-track')return <span className="goal-chip ok">On track</span>;
  if(plan.status==='behind')return <span className="goal-chip behind">Behind</span>;
  if(plan.status==='no-plan')return <span className="goal-chip idle">Set a monthly amount</span>;
  return <span className="goal-chip idle">No deadline</span>;
}
function GoalsSection({goals,budgets,assets,hidden,onNew,onEdit,onDeposit,onUpdateAssets}){
  const today=dateToday();
  const latest=useMemo(()=>latestAssetValues(assets||[]),[assets]);
  const active=goals.filter(g=>!g.archived);
  const plans=active.map(g=>({g,plan:goalPlan({...g,saved_amount:goalSaved(g,latest)},today)}));
  const shareUse={};active.forEach(g=>goalSources(g).forEach(x=>{shareUse[x.platform]=(shareUse[x.platform]||0)+Number(x.share)}));
  const overAlloc=Object.entries(shareUse).filter(([,v])=>v>100.0001);
  const money=v=>hidden?'•••':number(v);
  const totalSaved=sum(plans,x=>x.plan.saved), totalTarget=sum(plans,x=>x.plan.target);
  const totalMonthly=sum(plans.filter(x=>x.plan.status!=='done'),x=>x.plan.monthly);
  const totalNeeded=sum(plans.filter(x=>x.plan.status!=='done'),x=>x.plan.needed!=null?Math.max(x.plan.needed,x.plan.monthly):x.plan.monthly);
  const year=Number(today.slice(0,4));
  const tabBudget=(()=>{const rows=budgets.filter(b=>b.year===year&&b.category==='Tabungan');const g=rows.find(r=>!r.subcategory);return g?Number(g.monthly_amount):sum(rows,r=>r.monthly_amount)})();
  return <section className="surface goals-section">
    <div className="panel-heading"><div><span className="eyebrow">SAVINGS GOALS</span><h3>{active.length?`${money(totalSaved)} of ${money(totalTarget)}`:'Plan what you\'re saving for'}</h3></div><button className="btn btn-primary btn-small" onClick={onNew}><Plus size={14}/> New goal</button></div>
    {active.length>0&&<div className="goals-summary">
      <div><span>Planned per month</span><strong>{money(totalMonthly)}</strong></div>
      <div><span>Needed to hit all deadlines</span><strong className={totalNeeded>totalMonthly+1?'is-over':''}>{money(Math.ceil(totalNeeded/1000)*1000)}</strong></div>
      {tabBudget>0&&<div><span>Tabungan budget {year}</span><strong className={totalNeeded>tabBudget+1?'is-over':''}>{money(tabBudget)}</strong></div>}
    </div>}
    {overAlloc.length>0&&<div className="weekly-alerts">{overAlloc.map(([p,v])=><div key={p}><CircleHelp size={15}/> {p} is allocated {Math.round(v)}% across goals — keep the total at 100% or less.</div>)}</div>}
    {!active.length?<EmptyState icon={Target} title="No goals yet" description="Add goals like an emergency fund, Vietnam 2027 or land — the app will tell you how much to save each month and when you'll get there." action="Add first goal" onAction={onNew}/>:
    <div className="goal-list">{plans.map(({g,plan})=><article className="goal-card" key={g.id}>
      <div className="goal-top"><span className="goal-emoji" aria-hidden="true">{g.emoji||'🎯'}</span><div className="goal-title"><strong>{g.name}</strong><small>{g.target_date?`Target ${dateLabel(g.target_date)}`:'No deadline'}{plan.ret>0?` · ${plan.ret}%/yr return`:''}</small></div><GoalStatus plan={plan}/></div>
      {goalSources(g).length>0&&<div className="goal-sources">{goalSources(g).map(x=><span key={x.platform}>💼 {x.platform} {Number(x.share)}%{latest[x.platform]?'':' · no value yet'}</span>)}</div>}
      <div className="goal-bar"><i style={{width:`${plan.progress*100}%`}}/></div>
      <div className="goal-amounts"><span><strong>{money(plan.saved)}</strong> of {money(plan.target)}</span><span>{Math.round(plan.progress*100)}%</span></div>
      {plan.status!=='done'&&<div className="goal-calc">
        <div><span>Saving {money(plan.monthly)}/mo</span><strong>{plan.months==null?'Won\'t be reached':`Reached ${monthYear(plan.eta)} · ${durationText(plan.months)}`}</strong></div>
        {plan.needed!=null&&<div><span>To hit {monthYear(g.target_date)} ({durationText(plan.monthsLeft)} left)</span><strong className={plan.gap>1?'is-over':''}>{money(Math.ceil(plan.needed/1000)*1000)}/mo{plan.gap>1?` (+${hidden?'•••':compact(plan.gap)})`:''}</strong></div>}
      </div>}
      <div className="goal-actions">{goalSources(g).length?<button className="btn btn-soft btn-small" onClick={onUpdateAssets}><RefreshCw size={14}/> Update values</button>:<button className="btn btn-soft btn-small" onClick={()=>onDeposit(g)}><PiggyBank size={14}/> Add savings</button>}<button className="btn btn-outline btn-small" onClick={()=>onEdit(g)}><Pencil size={14}/> Edit</button></div>
    </article>)}</div>}
  </section>;
}
function GoalSheet({existing,assets=[],goals=[],onClose,onSave,onDelete}){
  const latest=latestAssetValues(assets);
  const platforms=[...new Set([...INVEST_PLATFORMS,...assets.map(a=>a.platform)])];
  const usedElsewhere=p=>sum(goals.filter(g=>g.id!==existing?.id&&!g.archived),g=>sum(goalSources(g).filter(x=>x.platform===p),x=>Number(x.share)));
  const [mode,setMode]=useState(goalSources(existing).length?'linked':'manual');
  const [shares,setShares]=useState(()=>Object.fromEntries(goalSources(existing).map(x=>[x.platform,String(x.share)])));
  const [emoji,setEmoji]=useState(existing?.emoji||'🎯'),[name,setName]=useState(existing?.name||''),[target,setTarget]=useState(String(existing?.target_amount??'')),[saved,setSaved]=useState(String(existing?.saved_amount??'0')),[monthly,setMonthly]=useState(String(existing?.monthly_contribution??'')),[ret,setRet]=useState(String(existing?.annual_return??'0')),[date,setDate]=useState(existing?.target_date||''),[note,setNote]=useState(existing?.note||''),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const sources=mode==='linked'?Object.entries(shares).filter(([,v])=>Number(v)>0).map(([platform,v])=>({platform,share:Math.min(100,Number(v))})):[];
  const linkedValue=sum(sources,x=>(latest[x.platform]?.value||0)*x.share/100);
  const valid=name.trim()&&Number(target)>0&&(mode==='manual'||sources.length>0);
  const plan=valid?goalPlan({target_amount:Number(target),saved_amount:mode==='linked'?linkedValue:Number(saved||0),monthly_contribution:Number(monthly||0),annual_return:Number(ret||0),target_date:date||null},dateToday()):null;
  async function submit(e){e.preventDefault();setSaving(true);setError('');try{await onSave({emoji,name:name.trim(),target_amount:Number(target),sources,saved_amount:Number(saved||0),monthly_contribution:Number(monthly||0),annual_return:Number(ret||0),target_date:date||null,note:note.trim()},existing);onClose()}catch(err){setError(err.message||'Couldn\'t save the goal.')}finally{setSaving(false)}}
  async function remove(){if(!window.confirm(`Delete goal "${existing.name}"?`))return;try{await onDelete(existing);onClose()}catch(err){setError(err.message||'Couldn\'t delete.')}}
  return <Sheet title={existing?'Edit goal':'New savings goal'} onClose={onClose}><form className="form sheet-form" onSubmit={submit}>
    <div><div className="field-label">Icon</div><div className="emoji-row">{GOAL_EMOJIS.map(x=><button type="button" key={x} className={emoji===x?'chosen':''} onClick={()=>setEmoji(x)}>{x}</button>)}</div></div>
    <label>Goal name<input required list="goal-names" maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Vietnam 2027"/><datalist id="goal-names">{GOAL_SUGGESTIONS.map(x=><option key={x} value={x}/>)}</datalist></label>
    <label>Target amount (Rp)<input type="number" inputMode="numeric" min="1" step="1" required value={target} onChange={e=>setTarget(e.target.value)}/></label>
    <div><div className="field-label">Where is this money kept?</div><Segmented label="Funding" value={mode} onChange={setMode} options={[{value:'manual',label:'Savings / cash'},{value:'linked',label:'Investments'}]}/></div>
    {mode==='manual'?<label>Saved so far (Rp)<input type="number" inputMode="numeric" min="0" step="1" value={saved} onChange={e=>setSaved(e.target.value)}/></label>:
    <div className="source-list">{platforms.map(p=>{const other=usedElsewhere(p),on=shares[p]!==undefined;return <div className={`source-row ${on?'on':''}`} key={p}>
      <label className="source-check"><input type="checkbox" checked={on} onChange={e=>setShares(sh=>{const n={...sh};if(e.target.checked)n[p]=String(Math.max(0,100-other));else delete n[p];return n})}/><span><strong>{p}</strong><small>{latest[p]?`${number(latest[p].value)} · ${dateLabel(latest[p].date)}`:'No value yet — add it in Update values'}{other>0?` · ${Math.round(other)}% used by other goals`:''}</small></span></label>
      {on&&<div className="share-input"><input type="number" inputMode="numeric" min="1" max="100" step="1" value={shares[p]} onChange={e=>setShares(sh=>({...sh,[p]:e.target.value}))} aria-label={`Share of ${p}`}/><span>%</span></div>}
    </div>})}
    <p className="field-help"><PiggyBank size={15}/> Progress = current value × share. It moves automatically each time you update asset values (weekly review). Use a share below 100% if one account holds several goals.</p>
    <div className="context-note"><Target size={16}/> Counted toward this goal now: <strong>&nbsp;{number(linkedValue)}</strong></div></div>}
    <div className="form-pair"><label>Saving per month (Rp)<input type="number" inputMode="numeric" min="0" step="1" value={monthly} onChange={e=>setMonthly(e.target.value)} placeholder="0"/></label><label>Target date <span className="optional">(optional)</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div>
    <label>Expected return per year (%)<select value={ret} onChange={e=>setRet(e.target.value)}><option value="0">0% — bank savings / cash</option><option value="4">4% — money market fund</option><option value="6">6% — bonds / mixed fund</option><option value="8">8% — mixed with stocks</option><option value="10">10% — equity (long term)</option>{!['0','4','6','8','10'].includes(String(Number(ret)))&&<option value={ret}>{ret}%</option>}</select></label>
    {plan&&<div className="goal-preview">
      <div><span>Still needed</span><strong>{number(plan.remaining)}</strong></div>
      <div><span>At {number(plan.monthly)}/mo</span><strong>{plan.status==='done'?'Already reached 🎉':plan.months==null?'Won\'t be reached — add a monthly amount':`${monthYear(plan.eta)} (${durationText(plan.months)})`}</strong></div>
      {plan.needed!=null&&<div><span>Needed to hit {monthYear(date)}</span><strong className={plan.gap>1?'is-over':''}>{number(Math.ceil(plan.needed/1000)*1000)}/mo</strong></div>}
    </div>}
    <label>Note <span className="optional">(optional)</span><input maxLength={300} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. kept in Bibit money market"/></label>
    {error&&<div className="feedback error" role="alert">{error}</div>}
    <button className="btn btn-primary full" disabled={saving||!valid}>{saving?'Saving...':'Save goal'}<Check size={17}/></button>
    {existing&&<button type="button" className="btn btn-outline full" onClick={remove}><Trash2 size={16}/> Delete goal</button>}
  </form></Sheet>;
}
function DepositSheet({goal,onClose,onSave}){
  const [mode,setMode]=useState('add'),[amount,setAmount]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const next=Math.max(0,Number(goal.saved_amount||0)+(mode==='add'?1:-1)*Number(amount||0));
  async function submit(e){e.preventDefault();setSaving(true);setError('');try{await onSave(goal,next);onClose()}catch(err){setError(err.message||'Couldn\'t save.')}finally{setSaving(false)}}
  return <Sheet title={`${goal.emoji||'🎯'} ${goal.name}`} onClose={onClose}><form className="form sheet-form" onSubmit={submit}>
    <Segmented label="Add or withdraw" value={mode} onChange={setMode} options={[{value:'add',label:'＋ Add savings'},{value:'withdraw',label:'－ Withdraw'}]}/>
    <label>Amount (Rp)<div className="amount-input-wrap"><span>Rp</span><input autoFocus type="number" inputMode="numeric" min="1" step="1" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></div></label>
    <div className="context-note"><PiggyBank size={16}/> Saved: {number(goal.saved_amount||0)} → <strong>{number(next)}</strong> of {number(goal.target_amount)}</div>
    <p className="field-help">This only updates the goal's progress. Record the actual transfer/investment as a transaction too (category Tabungan) so your budget stays accurate.</p>
    {error&&<div className="feedback error" role="alert">{error}</div>}
    <button className="btn btn-primary full" disabled={saving||!(Number(amount)>0)}>{saving?'Saving...':'Update progress'}<Check size={17}/></button>
  </form></Sheet>;
}

function GmailCard({isDemo,gmail}){
  const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState('');
  const status=gmail.status;
  const copy=async(text,what)=>{try{await navigator.clipboard.writeText(text);setCopied(what)}catch{setCopied('')}};
  async function create(){if(status?.active&&!window.confirm('Your old token will be revoked and Apps Script will need the new one. Continue?'))return;setBusy(true);try{setToken(await gmail.create())}finally{setBusy(false)}}
  async function revoke(){if(!window.confirm('Revoke the token? Gmail sync will stop until you create a new one.'))return;setBusy(true);try{await gmail.revoke();setToken('')}finally{setBusy(false)}}
  return <section className="surface family-box"><div className="family-card-icon family-gmail"><Mail size={23}/></div><h3>Auto sync from Gmail</h3><p className="muted">Bank and investment notifications in your Gmail are read by your own Google Apps Script and sent here. Clear ones are recorded automatically; the rest go to <strong>Needs review</strong>.</p>
    <div className="privacy-row"><span><KeyRound size={18}/></span><div><strong>Token status</strong><p>{isDemo?'Not available in demo mode.':status?.active?`Active · last used ${status.last_used_at?new Date(status.last_used_at).toLocaleString('en-GB'):'never'}`:'No token yet.'}</p></div></div>
    {token&&<><div className="invite-label">GMAIL TOKEN (SHOWN ONLY ONCE)</div><div className="invite-code"><code>{token}</code><IconButton label="Copy token" onClick={()=>copy(token,'token')}><Copy size={18}/></IconButton></div><p className="tiny-note">{copied==='token'?'Token copied. ':''}Paste it into the <code>INGEST_TOKEN</code> Script Property in Apps Script. Don't share it with anyone.</p></>}
    {!isDemo&&gmail.url&&<><div className="invite-label">SUPABASE_URL & PUBLISHABLE_KEY</div><div className="invite-code"><code>{gmail.url}</code><IconButton label="Copy URL" onClick={()=>copy(gmail.url,'url')}><Copy size={18}/></IconButton></div><div className="invite-code"><code>{gmail.key}</code><IconButton label="Copy key" onClick={()=>copy(gmail.key,'key')}><Copy size={18}/></IconButton></div></>}
    <div className="button-row"><button className="btn btn-primary" disabled={isDemo||busy} onClick={create}><KeyRound size={16}/> {status?.active?'Create new token':'Create token'}</button>{status?.active&&<button className="btn btn-outline" disabled={isDemo||busy} onClick={revoke}>Revoke</button>}</div>
  </section>;
}
function FamilyPage({household,user,members,me,isDemo,onCopy,onSignOut,onExitDemo,onToggleShare,gmail}){
  return <div className="page-stack"><div className="page-intro"><div><span className="eyebrow">FAMILY SPACE</span><h2>Transparent finances, privacy intact.</h2><p>Share the plan without having to share everything.</p></div></div><div className="family-cards">
    <section className="surface family-box"><div className="family-card-icon"><Users size={23}/></div><h3>{household.name}</h3><div className="member-list">{members.map(m=><div className="member" key={m.id}><Avatar name={m.display_name}/><span><strong>{m.display_name}{m.id===user.id?' (you)':''}</strong><small>{m.share_totals?'Sharing totals with the budget':'Private totals not shared'}</small></span></div>)}</div>{members.length<2&&<><div className="invite-label">PARTNER INVITE CODE</div><div className="invite-code"><code>{isDemo?'DEMO — no invite':household.invite_code}</code><IconButton label="Copy invite code" disabled={isDemo} onClick={onCopy}><Copy size={18}/></IconButton></div><p className="tiny-note">Only share this code with your partner.</p></>}</section>
    <section className="surface family-box"><div className="family-card-icon"><Target size={23}/></div><h3>Family budget</h3><p className="muted">For the budget to count both of your spending, each of you shares <strong>totals per category</strong> from your private accounts. Individual transactions stay private.</p><label className="toggle-row"><input type="checkbox" checked={Boolean(me?.share_totals)} disabled={isDemo} onChange={e=>onToggleShare(e.target.checked)}/><span><strong>Share my private totals with the budget</strong><small>Your partner only sees totals, e.g. "Makan Rp1.2M".</small></span></label></section>
    <GmailCard isDemo={isDemo} gmail={gmail}/>
    <section className="surface family-box account-settings"><div className="family-card-icon family-settings"><Settings2 size={23}/></div><h3>Your account</h3><p className="muted">{isDemo?'demo@familyfinance.app':user.email}</p>{isDemo?<button className="btn btn-outline full" onClick={onExitDemo}><ArrowRight size={17}/> Back to sign in</button>:<button className="btn btn-outline full" onClick={onSignOut}><LogOut size={17}/> Sign out</button>}</section>
  </div></div>;
}

function FinanceShell({user,household,accounts,transactions,budgets,inbox,members,me,fetchTotals,dataVersion,gmail,assets=[],onSaveAssets,onDeleteAsset,onMarkReviewed,goals=[],onSaveGoal,onDeleteGoal,onSetGoalSaved,onSaveAccount,onSaveTransaction,onDeleteAccount,onDeleteTransaction,onSaveBudget,onDeleteBudget,onRejectInbox,onToggleShare,onRefresh,onSignOut,isDemo=false,sync='online',busy=false}) {
  const [page,setPage]=useState('dashboard'),[txTab,setTxTab]=useState('history'),[txPreset,setTxPreset]=useState(null),[weeklyOpen,setWeeklyOpen]=useState(false),[scope,setScope]=useState('all'),[month,setMonth]=useState(monthNow()),[hidden,setHidden]=useState(false),[modal,setModal]=useState(null),[toast,setToast]=useState(null),[isOnline,setIsOnline]=useState(typeof navigator!=='undefined'?navigator.onLine:true);
  useEffect(()=>{const yes=()=>setIsOnline(true),no=()=>setIsOnline(false);window.addEventListener('online',yes);window.addEventListener('offline',no);return()=>{window.removeEventListener('online',yes);window.removeEventListener('offline',no)}},[]);
  const filteredAccounts=useMemo(()=>accounts.filter(a=>scope==='all'||a.visibility===scope),[accounts,scope]);
  const ids=useMemo(()=>new Set(filteredAccounts.map(a=>a.id)),[filteredAccounts]);
  const inScope=t=>ids.has(t.account_id)||(t.to_account_id&&ids.has(t.to_account_id))||(scope==='all'&&!accounts.some(a=>a.id===t.account_id));
  const scopedTransactions=useMemo(()=>transactions.filter(t=>inScope(t)),[transactions,ids,scope,accounts]);
  const notify=(message,type='success')=>setToast({message,type});
  // Weekly review: muncul otomatis jika belum review dalam 7 hari (sekali per hari jika ditunda).
  useEffect(()=>{let snoozed=false;try{snoozed=localStorage.getItem('ff-review-snooze')===dateToday()}catch{}
    let last=me?.last_review_at;try{last=last||localStorage.getItem('ff-last-review')}catch{}
    const due=!last||daysBetween(String(last).slice(0,10),dateToday())>=7;
    if(due&&!snoozed&&(transactions.length||accounts.length))setWeeklyOpen(true)},[me?.id]);
  const laterWeekly=()=>{try{localStorage.setItem('ff-review-snooze',dateToday())}catch{}setWeeklyOpen(false)};
  const doneWeekly=async()=>{setWeeklyOpen(false);try{await onMarkReviewed?.()}catch{}try{localStorage.setItem('ff-last-review',new Date().toISOString())}catch{}notify('Weekly review done — see you next week ✨')};
  const guarded=async(fn,success)=>{try{await fn();notify(success)}catch(err){notify(err.message||'Something went wrong. Please try again.','error');throw err}};
  const saveAccount=({current_balance,...rest},existing)=>{const moved=existing?sum(transactions,t=>txDelta(t,existing.id)):0;return guarded(()=>onSaveAccount({...rest,opening_balance:Math.round((current_balance-moved)*100)/100},existing),existing?'Account updated':'Account added')};
  const saveTransaction=(payload,existing,inboxItem)=>guarded(()=>onSaveTransaction(payload,existing,inboxItem),inboxItem?'Gmail transaction approved':existing?'Transaction updated':'Transaction saved');
  const saveBudget=(payload,existing)=>guarded(()=>onSaveBudget(payload,existing),'Budget saved');
  const deleteBudget=row=>guarded(()=>onDeleteBudget(row),'Budget line deleted');
  async function rejectInbox(it){try{await onRejectInbox(it);notify('Email dismissed')}catch(err){notify(err.message||'Something went wrong','error')}}
  async function toggleShare(v){try{await onToggleShare(v);notify(v?'Your private totals now count toward the budget':'Your private totals are no longer shared')}catch(err){notify(err.message||'Something went wrong','error')}}
  async function deleteTx(tx){if(!window.confirm(`Delete ${labelFor(tx)} transaction of ${number(tx.amount)}?`))return;try{await onDeleteTransaction(tx);notify('Transaction deleted')}catch(err){notify(err.message||'Couldn\'t delete the transaction','error')}}
  async function deleteAccount(a){if(transactions.some(t=>t.account_id===a.id||t.to_account_id===a.id)){notify('This account has transactions. Delete or move them before deleting the account.','error');return}if(!window.confirm(`Delete account ${a.name}?`))return;try{await onDeleteAccount(a);notify('Account deleted')}catch(err){notify(err.message||'Couldn\'t delete the account','error')}}
  async function copyCode(){try{await navigator.clipboard.writeText(household.invite_code);notify('Invite code copied')}catch{notify('Copy the code manually from the invite box.','error')}}
  function newItem(type){if(type==='transaction'&&!accounts.length){setPage('accounts');notify('Add an account before recording transactions.');return}setModal({type})}
  const goReview=()=>{setPage('transactions');setTxTab('review')};
  const sharers=members.filter(m=>m.id!==user.id&&m.share_totals).map(m=>m.display_name);
  const shareInfo=`Actuals = shared accounts + all your private accounts${sharers.length?` + ${sharers.join(', ')}'s private totals`:''}.${members.length>1&&!sharers.length?' Your partner hasn\'t shared their private totals yet (Family page).':''}`;
  const current=navItems.find(n=>n.id===page)||navItems[0];
  const navButton=id=>{const {label,Icon}=navItems.find(n=>n.id===id);return <button aria-current={page===id?'page':undefined} className={page===id?'active':''} key={id} onClick={()=>setPage(id)}><Icon size={21}/><span>{label}</span>{id==='transactions'&&inbox.length>0&&<i className="nav-badge">{inbox.length}</i>}</button>};
  return <div className="app-layout">
    <aside className="sidebar"><div className="sidebar-header"><Brand/><p>Money feels lighter, together.</p></div><div className="sidebar-family"><div className="family-mark"><Users size={19}/></div><div><strong>{household.name}</strong><span>Family space</span></div><ChevronDown size={16}/></div><div className="sidebar-label">MENU</div><nav className="sidebar-nav" aria-label="Main navigation">{navItems.map(({id,label,Icon})=><button key={id} aria-current={page===id?'page':undefined} className={`side-link ${page===id?'is-active':''}`} onClick={()=>setPage(id)}><Icon size={20}/>{label}{id==='transactions'&&inbox.length>0&&<span className="count-pill">{inbox.length}</span>}{page===id&&<span className="active-pill"/>}</button>)}</nav><button className="btn btn-primary sidebar-add" onClick={()=>newItem('transaction')}><Plus size={18}/> Add transaction</button><div className="sidebar-bottom"><div className="sidebar-security"><ShieldCheck size={19}/><div><strong>Privacy first</strong><span>Private stays private.</span></div></div><button className="profile-button" onClick={()=>setPage('family')}><Avatar name={me?.display_name||user.email||'K'}/><span><strong>{me?.display_name||'My account'}</strong><small>Settings</small></span><MoreHorizontal size={19}/></button></div></aside>
    <div className="workspace"><header className="top-header"><div className="mobile-brand"><Brand compactMode/><span>family<span className="brand-accent">finance.</span></span></div><div className="header-context"><span>Family space</span><strong>{household.name}</strong></div><div className="header-right"><span className={`sync-status ${!isOnline||sync==='offline'?'sync-offline':''}`} role="status">{!isOnline||sync==='offline'?<><CloudOff size={15}/> Offline</>:sync==='online'?<><Cloud size={15}/> Synced</>:<><RefreshCw size={14} className="spinning"/> Connecting</>}</span><IconButton label="Refresh" onClick={onRefresh} disabled={busy||isDemo}><RefreshCw size={19} className={busy?'spinning':''}/></IconButton><button className="avatar-button" onClick={()=>setPage('family')} aria-label="Family & settings"><Avatar name={me?.display_name||'K'}/></button></div></header>
      {isDemo&&<div className="demo-banner"><Sparkles size={16}/><span><strong>Demo mode.</strong> Sample data is only kept temporarily in this browser.</span><button onClick={()=>window.location.assign(window.location.pathname)}>Exit demo <ArrowRight size={14}/></button></div>}
      {!isOnline&&<div className="offline-banner"><WifiOff size={16}/> You're offline. New changes can't be saved until you're back online.</div>}
      <div className="mobile-page-title"><span>{current.label}</span><strong>{household.name}</strong></div>
      <main className="main-content" id="main-content">
        {page!=='family'&&<div className="toolbar">{page!=='budget'?<div className="scope-control"><span className="toolbar-caption">Show</span><Segmented label="Account scope" value={scope} onChange={setScope} options={[{value:'all',label:'All'},{value:'shared',label:'Shared'},{value:'private',label:'Private'}]}/></div>:<div className="scope-control"><span className="toolbar-caption">Family budget</span></div>}{page!=='accounts'&&page!=='transactions'&&<MonthPicker value={month} onChange={setMonth}/>}</div>}
        {page==='dashboard'&&<Dashboard user={user} accounts={filteredAccounts} allAccounts={accounts} transactions={transactions} scope={scope} month={month} hidden={hidden} setHidden={setHidden} onPage={setPage} onNew={newItem} onEdit={t=>setModal({type:'transaction',item:t})} onDelete={deleteTx} pendingCount={inbox.length} onReview={goReview} fetchTotals={fetchTotals} dataVersion={dataVersion} onWeekly={()=>setWeeklyOpen(true)} onOpenCategory={(group,sub)=>{setTxPreset({group,sub,month,at:Date.now()});setTxTab('history');setPage('transactions')}}/>}
        {page==='transactions'&&<TransactionsPage items={scopedTransactions} month={month} accounts={accounts} userId={user.id} hidden={hidden} onEdit={t=>setModal({type:'transaction',item:t})} onDelete={deleteTx} onNew={newItem} inbox={inbox} onApproveInbox={it=>setModal({type:'transaction',draft:it})} onRejectInbox={rejectInbox} tab={txTab} setTab={setTxTab} preset={txPreset}/>}
        {page==='budget'&&<BudgetPage budgets={budgets} fetchTotals={fetchTotals} dataVersion={dataVersion} month={month} hidden={hidden} shareInfo={shareInfo} onEditBudget={b=>setModal({type:'budget',item:b})} onNewBudget={()=>setModal({type:'budget'})}/>}
        {page==='accounts'&&<AccountsPage accounts={filteredAccounts} transactions={transactions} userId={user.id} hidden={hidden} onEdit={a=>setModal({type:'account',item:a})} onDelete={deleteAccount} onNew={newItem} assets={assets} onUpdateAssets={()=>setModal({type:'assets'})} onEditAsset={a=>setModal({type:'assets',item:a})} goals={goals} budgets={budgets} onNewGoal={()=>setModal({type:'goal'})} onEditGoal={g=>setModal({type:'goal',item:g})} onDepositGoal={g=>setModal({type:'deposit',item:g})}/>}
        {page==='family'&&<FamilyPage household={household} user={user} members={members} me={me} isDemo={isDemo} onCopy={copyCode} onSignOut={onSignOut} onExitDemo={()=>window.location.assign(window.location.pathname)} onToggleShare={toggleShare} gmail={gmail}/>}
        <footer className="app-footer">Family Finance · Tidier records, surer plans. <span>♡</span></footer>
      </main>
    </div>
    <nav className="bottom-nav" aria-label="Bottom navigation">{BOTTOM_NAV.slice(0,2).map(navButton)}<button className="bottom-add" aria-label="Add transaction" onClick={()=>newItem('transaction')}><Plus size={29}/></button>{BOTTOM_NAV.slice(2).map(navButton)}</nav>
    <Notice notice={toast} onClose={()=>setToast(null)}/>
    {modal?.type==='account'&&<AccountSheet existing={modal.item} currentBalance={modal.item?getBalance(modal.item,transactions):0} onClose={()=>setModal(null)} onSave={saveAccount}/>}
    {modal?.type==='transaction'&&<TransactionSheet existing={modal.item} draft={modal.draft} accounts={accounts} onClose={()=>setModal(null)} onSave={(payload,existing)=>saveTransaction(payload,existing,modal.draft)}/>}
    {modal?.type==='assets'&&<AssetUpdateSheet assets={assets} existing={modal.item} onClose={()=>setModal(null)} onSave={rows=>guarded(()=>onSaveAssets(rows,modal.item),'Asset values saved')} onDelete={a=>guarded(()=>onDeleteAsset(a),'Asset entry deleted')}/>}
    {modal?.type==='goal'&&<GoalSheet existing={modal.item} assets={assets} goals={goals} onClose={()=>setModal(null)} onSave={(payload,existing)=>guarded(()=>onSaveGoal(payload,existing),existing?'Goal updated':'Goal added')} onDelete={g=>guarded(()=>onDeleteGoal(g),'Goal deleted')}/>}
    {modal?.type==='deposit'&&<DepositSheet goal={modal.item} onClose={()=>setModal(null)} onSave={(g,v)=>guarded(()=>onSetGoalSaved(g,v),'Goal progress updated')}/>}
    {weeklyOpen&&<WeeklyReview transactions={transactions} accounts={accounts} budgets={budgets} assets={assets} inbox={inbox} hidden={hidden} onClose={()=>setWeeklyOpen(false)} onLater={laterWeekly} onDone={doneWeekly} onUpdateAssets={()=>{setWeeklyOpen(false);setPage('accounts');setModal({type:'assets'})}} onReviewGmail={()=>{setWeeklyOpen(false);goReview()}}/>}
    {modal?.type==='budget'&&<BudgetSheet existing={modal.item} year={Number(month.slice(0,4))} onClose={()=>setModal(null)} onSave={saveBudget} onDelete={deleteBudget}/>}
  </div>;
}

function LiveApp(){
  const [user,setUser]=useState(undefined),[household,setHousehold]=useState(undefined),[accounts,setAccounts]=useState([]),[transactions,setTransactions]=useState([]),[budgets,setBudgets]=useState([]),[inbox,setInbox]=useState([]),[members,setMembers]=useState([]),[tokenStatus,setTokenStatus]=useState(null),[assets,setAssets]=useState([]),[goals,setGoals]=useState([]),[dataVersion,setDataVersion]=useState(0),[busy,setBusy]=useState(false),[sync,setSync]=useState('connecting'),[error,setError]=useState(''),[reload,setReload]=useState(0);
  useEffect(()=>{if(!configured)return;let alive=true;supabase.auth.getUser().then(({data,error})=>{if(!alive)return;setUser(data?.user||null);if(error)setError(error.message)}).catch(err=>{if(alive){setUser(null);setError(err.message)}});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(!alive)return;setUser(session?.user||null);if(!session){setHousehold(undefined);setAccounts([]);setTransactions([]);setBudgets([]);setInbox([])}});return()=>{alive=false;subscription.unsubscribe()}},[]);
  useEffect(()=>{if(!user)return;let alive=true;setHousehold(undefined);(async()=>{try{const {data:member,error:e}=await supabase.from('household_members').select('household_id').eq('user_id',user.id).maybeSingle();if(e)throw e;if(!member){if(alive)setHousehold(null);return}const {data:h,error:he}=await supabase.from('households').select('*').eq('id',member.household_id).single();if(he)throw he;if(alive)setHousehold(h)}catch(err){if(alive){setError(err.message);setHousehold(null)}}})();return()=>{alive=false}},[user?.id,reload]);
  const loadData=useCallback(async()=>{if(!household?.id)return;setBusy(true);try{
    const [a,t,b,i,m,ts,as,gl]=await Promise.all([
      supabase.from('accounts').select('*').eq('household_id',household.id).order('created_at'),
      supabase.from('transactions').select('*').eq('household_id',household.id).order('occurred_on',{ascending:false}).order('created_at',{ascending:false}).limit(3000),
      supabase.from('budgets').select('*').eq('household_id',household.id),
      supabase.from('inbox_items').select('*').eq('status','pending').order('occurred_on',{ascending:false}).limit(200),
      supabase.from('household_members').select('user_id').eq('household_id',household.id),
      supabase.rpc('ingest_token_status'),
      supabase.from('asset_snapshots').select('*').eq('household_id',household.id).order('recorded_on'),
      supabase.from('savings_goals').select('*').eq('household_id',household.id).order('created_at')]);
    const firstError=[a,t,b,i,m,as,gl].find(r=>r.error)?.error;if(firstError)throw firstError;
    const ids=(m.data||[]).map(x=>x.user_id);const p=await supabase.from('profiles').select('*').in('id',ids);if(p.error)throw p.error;
    setAccounts(a.data||[]);setTransactions(t.data||[]);setBudgets(b.data||[]);setInbox(i.data||[]);setMembers(p.data||[]);setTokenStatus(ts.error?null:ts.data);setAssets(as.data||[]);setGoals(gl.data||[]);setDataVersion(v=>v+1);setError('')
  }catch(e){setError(e.message||'Couldn\'t load data — check your connection.')}finally{setBusy(false)}},[household?.id]);
  useEffect(()=>{loadData()},[loadData]);
  useEffect(()=>{if(!household?.id)return;setSync('connecting');const f='household_id=eq.'+household.id;const channel=supabase.channel('family-finance-'+household.id).on('postgres_changes',{event:'*',schema:'public',table:'accounts',filter:f},loadData).on('postgres_changes',{event:'*',schema:'public',table:'transactions',filter:f},loadData).on('postgres_changes',{event:'*',schema:'public',table:'budgets',filter:f},loadData).on('postgres_changes',{event:'*',schema:'public',table:'inbox_items',filter:f},loadData).on('postgres_changes',{event:'*',schema:'public',table:'asset_snapshots',filter:f},loadData).on('postgres_changes',{event:'*',schema:'public',table:'savings_goals',filter:f},loadData).subscribe(s=>{if(s==='SUBSCRIBED')setSync('online');else if(s==='CLOSED'||s==='TIMED_OUT'||s==='CHANNEL_ERROR')setSync('offline');else setSync('connecting')});const onFocus=()=>loadData();window.addEventListener('focus',onFocus);window.addEventListener('online',onFocus);return()=>{supabase.removeChannel(channel);window.removeEventListener('focus',onFocus);window.removeEventListener('online',onFocus)}},[household?.id,loadData]);
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
  const onSaveAssets=async(rows,existing)=>{
    if(existing&&rows[0]&&rows[0].recorded_on!==existing.recorded_on){const {error:de}=await supabase.from('asset_snapshots').delete().eq('id',existing.id);if(de)throw de}
    const {error}=await supabase.from('asset_snapshots').upsert(rows.map(r=>({...r,household_id:household.id,created_by:user.id})),{onConflict:'household_id,platform,recorded_on'});if(error)throw error;await loadData()};
  const onDeleteAsset=async a=>{const {error}=await supabase.from('asset_snapshots').delete().eq('id',a.id);if(error)throw error;await loadData()};
  const onSaveGoal=async(payload,existing)=>{const q=existing?supabase.from('savings_goals').update({...payload,updated_at:new Date().toISOString()}).eq('id',existing.id):supabase.from('savings_goals').insert({...payload,household_id:household.id,created_by:user.id});const {error}=await q;if(error)throw error;await loadData()};
  const onDeleteGoal=async g=>{const {error}=await supabase.from('savings_goals').delete().eq('id',g.id);if(error)throw error;await loadData()};
  const onSetGoalSaved=async(g,v)=>{const {error}=await supabase.from('savings_goals').update({saved_amount:v,updated_at:new Date().toISOString()}).eq('id',g.id);if(error)throw error;await loadData()};
  const onMarkReviewed=async()=>{const {error}=await supabase.from('profiles').update({last_review_at:new Date().toISOString()}).eq('id',user.id);if(error)throw error;await loadData()};
  const onRejectInbox=async it=>{const {error}=await supabase.from('inbox_items').update({status:'rejected'}).eq('id',it.id);if(error)throw error;await loadData()};
  const onToggleShare=async v=>{const {error}=await supabase.from('profiles').update({share_totals:v}).eq('id',user.id);if(error)throw error;await loadData()};
  const gmail={status:tokenStatus,url:import.meta.env.VITE_SUPABASE_URL,key:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    create:async()=>{const {data,error}=await supabase.rpc('create_ingest_token');if(error)throw error;await loadData();return data},
    revoke:async()=>{const {error}=await supabase.rpc('revoke_ingest_token');if(error)throw error;await loadData()}};
  if(!configured)return <ConfigMissing/>;
  if(user===undefined || (user&&household===undefined))return <div className="app-loading"><Brand/><div className="loader"/><p>Getting things ready...</p></div>;
  if(!user)return <><Auth onDemo={()=>window.location.assign('?demo=1')}/>{error&&<div className="fixed-error">{error}</div>}</>;
  if(!household)return <><Setup onDone={()=>setReload(x=>x+1)}/>{error&&<div className="fixed-error">{error}</div>}</>;
  const me=members.find(m=>m.id===user.id)||{id:user.id,display_name:user.user_metadata?.display_name||'Me',share_totals:false};
  return <><FinanceShell user={user} household={household} accounts={accounts} transactions={transactions} budgets={budgets} inbox={inbox} members={members.length?members:[me]} me={me} fetchTotals={fetchTotals} dataVersion={dataVersion} gmail={gmail} assets={assets} onSaveAssets={onSaveAssets} onDeleteAsset={onDeleteAsset} onMarkReviewed={onMarkReviewed} goals={goals} onSaveGoal={onSaveGoal} onDeleteGoal={onDeleteGoal} onSetGoalSaved={onSetGoalSaved} onSaveAccount={onSaveAccount} onSaveTransaction={onSaveTransaction} onDeleteAccount={onDeleteAccount} onDeleteTransaction={onDeleteTransaction} onSaveBudget={onSaveBudget} onDeleteBudget={onDeleteBudget} onRejectInbox={onRejectInbox} onToggleShare={onToggleShare} onRefresh={loadData} onSignOut={()=>supabase.auth.signOut()} sync={sync} busy={busy}/>{error&&<div className="fixed-error" role="alert">{error} <button onClick={loadData}>Retry</button></div>}</>;
}
function ConfigMissing(){return <div className="onboard-page"><div className="onboard-card"><Brand/><WelcomeBadge name="Ready to go"/><h1>Family Finance is ready.</h1><p className="muted">Explore the design with sample data, or add your Supabase settings to use real accounts.</p><div className="config-steps"><p>To connect the cloud, fill in <code>.env</code>:</p><code>VITE_SUPABASE_URL=...<br/>VITE_SUPABASE_PUBLISHABLE_KEY=...</code></div><button className="btn btn-primary full" onClick={()=>window.location.assign('?demo=1')}>Explore the demo <ArrowRight size={18}/></button><p className="tiny-note">The demo doesn't use a database or save real transactions.</p></div></div>}

const DEMO_BUDGET=[['Kebutuhan','Makan',2800000],['Kebutuhan','Transport',1900000],['Kebutuhan','Home',1750000],['Kebutuhan','Kesehatan',350000],['Kebutuhan','Bodycare and Skincare',350000],['Kebutuhan','Biaya Transaksi',25000],['Keinginan','JAJAN',900000],['Keinginan','GIFT',300000],['Keinginan','Hobby',400000],['Keinginan','Online Subscription',100000],['Keinginan','others',500000],['Tabungan','',10225000]];
function makeDemo(){
  const household={id:'demo-family',name:'Our Family',invite_code:'demo-not-active'};
  const user={id:'demo-me',email:'demo@familyfinance.app',user_metadata:{display_name:'Uwi'}};
  const members=[{id:'demo-me',display_name:'Uwi',share_totals:true},{id:'demo-partner',display_name:'Vitto',share_totals:true}];
  const accounts=[{id:'demo-mandiri',name:'MANDIRI',visibility:'private',opening_balance:6500000,owner_id:user.id},{id:'demo-jago',name:'JAGO BAYAR',visibility:'private',opening_balance:1500000,owner_id:user.id},{id:'demo-skyz',name:'SKYZ',visibility:'private',opening_balance:0,owner_id:user.id,kind:'credit',credit_limit:25000000},{id:'demo-kas',name:'Joint Cash',visibility:'shared',opening_balance:3000000,owner_id:user.id}];
  const spend=[['Kebutuhan','Makan',[820000,640000,910000],'demo-jago'],['Kebutuhan','Transport',[410000,520000,380000],'demo-jago'],['Kebutuhan','Home',[452500,1350000],'demo-skyz'],['Keinginan','JAJAN',[255000,190000,320000],'demo-mandiri'],['Keinginan','GIFT',[150000,100000],'demo-mandiri'],['Kebutuhan','Kesehatan',[350000],'demo-skyz'],['Keinginan','others',[150000,105000],'demo-skyz'],['Tabungan','Reksadana',[1500000],'demo-mandiri'],['Tabungan','GORO',[500000],'demo-mandiri']];
  const tx=[];for(let i=5;i>=0;i--){const m=shiftMonth(monthNow(),-i);tx.push({id:`income-${m}`,account_id:'demo-mandiri',kind:'income',amount:11600000,category:'Pemasukan',subcategory:'Gaji',note:'Gaji',occurred_on:m+'-01',created_by:user.id,source:'manual'});
    tx.push({id:`tf-${m}`,account_id:'demo-mandiri',to_account_id:'demo-jago',kind:'transfer',amount:2000000,category:'Transfer',subcategory:'',note:'Isi Jago',occurred_on:m+'-02',created_by:user.id,source:'manual'});
    spend.forEach(([g,sub,amts,acc],j)=>amts.forEach((v,k)=>tx.push({id:`e-${m}-${j}-${k}`,account_id:acc,kind:'expense',amount:Math.round(v*(1+((i+j)%3)*0.08)),category:g,subcategory:sub,note:'',occurred_on:`${m}-${String(Math.min(i===0?Number(dateToday().slice(8)):28,3+j*3+k)).padStart(2,'0')}`,created_by:user.id,source:j%2?'gmail':'manual'})))}
  const year=Number(monthNow().slice(0,4));
  const budgets=[year,2027].flatMap(y=>DEMO_BUDGET.map(([category,subcategory,amount],i)=>({id:`b-${y}-${i}`,year:y,category,subcategory,monthly_amount:amount,note:category==='Tabungan'?'Dana Darurat 1,5 jt · Liburan 2,5 jt · Tanah/Rumah 5 jt · Investasi 1,225 jt':''})));
  const today=dateToday();
  const inbox=[{id:'in-1',external_id:'g1',sender:'noreply.livin@bankmandiri.co.id',subject:'Pembayaran QRIS Berhasil',merchant:'SUKA ROTI',kind:'expense',amount:38000,category:'Kebutuhan',subcategory:'',account_hint:'SKYZ',occurred_on:today,reason:'Unknown merchant'},{id:'in-2',external_id:'g2',sender:'bca@bca.co.id',subject:'Internet Transaction Journal',merchant:'Transfer ke ENOH SULASTRI',kind:'expense',amount:210000,category:'',subcategory:'',account_hint:'BCA',occurred_on:today,reason:'Outgoing transfer — pick a category'}];
  const assets=[];for(let w=7;w>=0;w--){const d=new Date();d.setDate(d.getDate()-w*7);const day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;[['Bibit',14200000,180000],['Gotrade',4100000,-60000],['GORO',2500000,105000]].forEach(([p,base,step],k)=>assets.push({id:`as-${w}-${k}`,platform:p,value:Math.round(base+step*(7-w)+((w*37+k*11)%5-2)*45000),recorded_on:day}))}
  const goals=[{id:'g1',emoji:'🛟',name:'Emergency fund',target_amount:30000000,saved_amount:0,monthly_contribution:1500000,annual_return:4,target_date:null,sources:[{platform:'Bibit',share:60}]},
    {id:'g2',emoji:'🏝️',name:'Vietnam 2027',target_amount:20000000,saved_amount:5000000,monthly_contribution:2000000,annual_return:0,target_date:'2027-05-28'},
    {id:'g3',emoji:'🗾',name:'Japan 2028',target_amount:45000000,saved_amount:0,monthly_contribution:1000000,annual_return:4,target_date:'2027-12-31',sources:[{platform:'Bibit',share:40},{platform:'Gotrade',share:100}]},
    {id:'g4',emoji:'🏡',name:'Land / house',target_amount:500000000,saved_amount:0,monthly_contribution:5000000,annual_return:6,target_date:null,sources:[{platform:'GORO',share:100}]}];
  return {household,user,members,accounts,budgets,inbox,assets,goals,tx:tx.sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on))};
}
function demoTotals(transactions,year){const map={};transactions.filter(t=>t.occurred_on.startsWith(`${year}-`)).forEach(t=>{const k=[t.occurred_on.slice(0,7),t.kind,t.category,t.subcategory||''].join('|');map[k]=(map[k]||0)+Number(t.amount)});return Object.entries(map).map(([k,total])=>{const [month,kind,category,subcategory]=k.split('|');return {month,kind,category,subcategory,total}})}
function DemoApp(){const sample=useMemo(makeDemo,[]),[accounts,setAccounts]=useState(sample.accounts),[transactions,setTransactions]=useState(sample.tx),[budgets,setBudgets]=useState(sample.budgets),[inbox,setInbox]=useState(sample.inbox),[members,setMembers]=useState(sample.members),[assets,setAssets]=useState(sample.assets),[goals,setGoals]=useState(sample.goals);
  const saveAccount=async(payload,existing)=>{setAccounts(a=>existing?a.map(x=>x.id===existing.id?{...x,...payload}:x):[...a,{...payload,id:`demo-a-${crypto.randomUUID()}`,owner_id:sample.user.id}])};
  const saveTransaction=async(payload,existing,inboxItem)=>{setTransactions(a=>existing?a.map(x=>x.id===existing.id?{...x,...payload}:x):[{...payload,id:`demo-t-${crypto.randomUUID()}`,created_by:sample.user.id,source:inboxItem?'gmail':'manual'},...a].sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on)));if(inboxItem)setInbox(s=>s.filter(x=>x.id!==inboxItem.id))};
  const saveBudget=async(payload,existing)=>setBudgets(s=>existing?s.map(x=>x.id===existing.id?{...x,monthly_amount:payload.monthly_amount,note:payload.note}:x):[...s,{...payload,id:`b-${crypto.randomUUID()}`}]);
  const deleteBudget=async row=>setBudgets(s=>s.filter(x=>x.id!==row.id));
  const deleteAccount=async a=>setAccounts(s=>s.filter(x=>x.id!==a.id));const deleteTransaction=async t=>setTransactions(s=>s.filter(x=>x.id!==t.id));
  const fetchTotals=useCallback(async year=>demoTotals(transactions,year),[transactions]);
  const me=members.find(m=>m.id===sample.user.id);
  return <FinanceShell isDemo user={sample.user} household={sample.household} accounts={accounts} transactions={transactions} budgets={budgets} inbox={inbox} members={members} me={me} fetchTotals={fetchTotals} dataVersion={transactions.length} gmail={{status:null}} assets={assets} onSaveAssets={async(rows,existing)=>setAssets(s=>{let n=existing?s.filter(x=>x.id!==existing.id):s;rows.forEach(r=>{n=n.filter(x=>!(x.platform===r.platform&&x.recorded_on===r.recorded_on));n=[...n,{...r,id:`as-${crypto.randomUUID()}`}]});return n})} onDeleteAsset={async a=>setAssets(s=>s.filter(x=>x.id!==a.id))} goals={goals} onSaveGoal={async(p,e)=>setGoals(s=>e?s.map(x=>x.id===e.id?{...x,...p}:x):[...s,{...p,id:`g-${crypto.randomUUID()}`}])} onDeleteGoal={async g=>setGoals(s=>s.filter(x=>x.id!==g.id))} onSetGoalSaved={async(g,v)=>setGoals(s=>s.map(x=>x.id===g.id?{...x,saved_amount:v}:x))} onSaveAccount={saveAccount} onSaveTransaction={saveTransaction} onDeleteAccount={deleteAccount} onDeleteTransaction={deleteTransaction} onSaveBudget={saveBudget} onDeleteBudget={deleteBudget} onRejectInbox={async it=>setInbox(s=>s.filter(x=>x.id!==it.id))} onToggleShare={async v=>setMembers(s=>s.map(m=>m.id===sample.user.id?{...m,share_totals:v}:m))} onRefresh={()=>{}} onSignOut={()=>window.location.assign(window.location.pathname)} sync="online"/>;
}
export default function App(){return new URLSearchParams(window.location.search).has('demo')?<DemoApp/>:<LiveApp/>}
