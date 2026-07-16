/**
 * ============================================
 * bidernet · Tasks (v1.0.0)
 * React 18 + htm (בלי build) + Tailwind CDN
 * ============================================
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import {
  LayoutGrid, Clock, User, Users, Building2, LogOut, Plus, Search, Download,
  RefreshCw, X, Trash2, Paperclip, MessageSquare, Send, AlertTriangle, Check, Pencil,
  Settings, MessageCircle, ExternalLink, Bell, Lock, Eye,
  Menu, ChevronLeft, SlidersHorizontal, ArrowRightLeft, AlarmClock, Repeat,
  Activity, TrendingUp, Target, DollarSign, FileText, CheckCircle2, MessageCircle as MsgIcon, ExternalLink as LinkIcon,
  Facebook, Link2, Unlink, RefreshCw as Refresh2
} from 'lucide-react';

const html = htm.bind(React.createElement);
const API = './api.php';

const APP_VERSION = '1.3.1';
console.log(`🎯 bidernet Tasks v${APP_VERSION}`);

/* ============ API helper ============ */
async function api(action, { method = 'GET', body, query = {}, form } = {}) {
  const qs = new URLSearchParams({ action, ...query }).toString();
  const opts = { method, credentials: 'same-origin' };
  if (form) opts.body = form;
  else if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}?${qs}`, opts);
  const data = await res.json().catch(() => ({ error: 'תשובה לא תקינה מהשרת' }));
  if (!res.ok) throw new Error(data.error || 'שגיאה');
  return data;
}

/* ============ Constants ============ */
const COLS = [
  { key: 'todo',        label: 'לביצוע',  color: '#94a3b8' },
  { key: 'in_progress', label: 'בעבודה',  color: '#013d19' },
  { key: 'review',      label: 'לבדיקה',  color: '#f59e0b' },
  { key: 'done',        label: 'בוצע',    color: '#10b981' },
];
const PRIOS = {
  urgent: { label: 'דחוף', bar: '#dc2626' },
  high:   { label: 'גבוה', bar: '#f97316' },
  normal: { label: 'רגיל', bar: '#d4d4d8' },
  low:    { label: 'נמוך', bar: '#e4e4e7' },
};
const AVATAR_COLORS = ['#013d19','#f43f5e','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#0ea5e9','#84cc16','#64748b'];

/* ============ Color picker ============ */
function ColorPicker({ value, onChange }) {
  const val = value || '#013d19';
  const [hex, setHex] = useState(val);
  useEffect(() => setHex(val), [val]);

  const commit = (v) => {
    const clean = v.startsWith('#') ? v : '#' + v;
    setHex(clean);
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) onChange(clean);
  };

  return html`
    <div class="space-y-2.5">
      <div class="flex items-center gap-2">
        <input type="color" value=${val} onChange=${e => { setHex(e.target.value); onChange(e.target.value); }}
          class="w-11 h-10 rounded-xl border border-zinc-200 cursor-pointer bg-white p-0.5 shrink-0" />
        <input class=${`${inputCls} font-mono`} dir="ltr" value=${hex} maxLength=${7}
               placeholder="#013d19" onChange=${e => commit(e.target.value)} />
        <div class="w-10 h-10 rounded-xl border border-zinc-200 shrink-0" style=${{ background: val }}></div>
      </div>
      <div class="flex gap-1.5 flex-wrap">
        ${AVATAR_COLORS.map(c => html`
          <button key=${c} type="button" onClick=${() => onChange(c)} aria-label=${c}
            class=${`w-7 h-7 rounded-full grid place-items-center transition ${
              val.toLowerCase() === c ? 'ring-2 ring-offset-2 ring-brand-green' : 'hover:scale-110'}`}
            style=${{ background: c }}>
            ${val.toLowerCase() === c && html`<${Check} size=${13} color="#fff" />`}
          </button>`)}
      </div>
    </div>`;
}

/* ============ Utils ============ */
const initials = (n) => (n || '?').trim().slice(0, 2);

// 052-660-4361 / 0526604361 / +972526604361  →  972526604361
const intlPhone = (raw, cc = '972') => {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = cc + d.slice(1);
  else if (!d.startsWith(cc) && d.length <= 9) d = cc + d;
  return d;
};
const today = () => new Date().setHours(0, 0, 0, 0);
const isLate = (t) => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < today();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) : '';
const fmtStamp = (d) => new Date(d.replace(' ', 'T')).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב'; };

/* ============ Responsive ============ */
function useIsMobile() {
  const [m, setM] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const on = e => setM(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

/* ============ Small components ============ */
const Avatar = ({ user, size = 28 }) => html`
  <div class="rounded-full text-white grid place-items-center font-semibold shrink-0"
       style=${{ width: size, height: size, background: user?.color || '#94a3b8', fontSize: size * .4 }}
       title=${user?.name || ''}>
    ${initials(user?.name)}
  </div>`;

const Btn = ({ children, variant = 'lime', className = '', ...p }) => {
  const v = {
    lime:  'bg-brand-lime text-brand-green hover:brightness-95',
    green: 'bg-brand-green text-white hover:brightness-125',
    ghost: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
    danger:'text-red-600 hover:bg-red-50',
  }[variant];
  return html`<button class=${`rounded-xl px-4 py-2 font-semibold transition ${v} ${className}`} ...${p}>${children}</button>`;
};

const Field = ({ label, children }) => html`
  <label class="block">
    <span class="block text-xs font-semibold text-zinc-500 mb-1.5">${label}</span>
    ${children}
  </label>`;

const inputCls = 'w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-base sm:text-sm outline-none focus:border-brand-green transition';

/* ============ Login ============ */
function Login({ onLogin }) {
  const params = new URLSearchParams(location.search);
  const resetToken = params.get('reset');

  const [screen, setScreen] = useState(resetToken ? 'reset' : 'login');
  const [username, setU] = useState(() => localStorage.getItem('bidernet_user') || '');
  const [password, setP] = useState('');
  const [password2, setP2] = useState('');
  const [email, setEmail] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username || !password) return setErr('נא למלא שם משתמש וסיסמה');
    setBusy(true); setErr('');
    try {
      const u = await api('login', { method: 'POST', body: { username, password, remember } });
      // שם המשתמש נשמר לנוחות; הסיסמה לעולם לא נשמרת בדפדפן
      if (remember) localStorage.setItem('bidernet_user', username);
      else localStorage.removeItem('bidernet_user');
      onLogin(u);
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const forgot = async () => {
    if (!email) return setErr('נא למלא כתובת אימייל');
    setBusy(true); setErr('');
    try {
      await api('forgot', { method: 'POST', body: { email } });
      setNote('אם הכתובת רשומה במערכת, נשלח אליה קישור לאיפוס הסיסמה. הקישור תקף לשעה.');
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const reset = async () => {
    if (password.length < 6)   return setErr('הסיסמה חייבת להכיל לפחות 6 תווים');
    if (password !== password2) return setErr('הסיסמאות לא תואמות');
    setBusy(true); setErr('');
    try {
      const r = await api('reset_password', { method: 'POST', body: { token: resetToken, password } });
      setU(r.username || ''); setP(''); setP2('');
      history.replaceState({}, '', location.pathname);
      setScreen('login');
      setNote('הסיסמה עודכנה. אפשר להתחבר.');
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const box = (children) => html`
    <div class="min-h-screen grid place-items-center bg-white px-4">
      <div class="w-full max-w-sm">
        <img src="./logo.png" alt="bidernet" class="h-12 mx-auto mb-2 object-contain" />
        <p class="text-center text-zinc-500 mb-8">משימות ועדכונים</p>
        ${err  && html`<div class="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-4">${err}</div>`}
        ${note && html`<div class="text-sm text-brand-green bg-brand-mint rounded-xl px-3 py-2 mb-4">${note}</div>`}
        ${children}
      </div>
    </div>`;

  if (screen === 'forgot') return box(html`
    <div class="space-y-4">
      <p class="text-sm text-zinc-500 leading-relaxed">
        הזן את כתובת האימייל שרשומה במערכת. נשלח אליה קישור לבחירת סיסמה חדשה.
      </p>
      <${Field} label="אימייל">
        <input type="email" dir="ltr" class=${inputCls} value=${email} autoFocus
               onChange=${e => setEmail(e.target.value)}
               onKeyDown=${e => e.key === 'Enter' && forgot()} />
      <//>
      <${Btn} className="w-full" onClick=${forgot} disabled=${busy}>
        ${busy ? 'שולח…' : 'שלח קישור לאיפוס'}
      <//>
      <button class="w-full text-sm text-zinc-500 hover:text-zinc-800 py-1"
              onClick=${() => { setScreen('login'); setErr(''); setNote(''); }}>
        חזרה להתחברות
      </button>
    </div>`);

  if (screen === 'reset') return box(html`
    <div class="space-y-4">
      <p class="text-sm text-zinc-500">בחר סיסמה חדשה למערכת.</p>
      <${Field} label="סיסמה חדשה">
        <input type="password" class=${inputCls} value=${password} autoFocus
               onChange=${e => setP(e.target.value)} />
      <//>
      <${Field} label="אימות סיסמה">
        <input type="password" class=${inputCls} value=${password2}
               onChange=${e => setP2(e.target.value)}
               onKeyDown=${e => e.key === 'Enter' && reset()} />
      <//>
      <${Btn} className="w-full" onClick=${reset} disabled=${busy}>
        ${busy ? 'מעדכן…' : 'עדכון הסיסמה'}
      <//>
    </div>`);

  return box(html`
    <div class="space-y-4">
      <${Field} label="שם משתמש">
        <input class=${inputCls} value=${username} autoFocus autoComplete="username"
               onChange=${e => setU(e.target.value)}
               onKeyDown=${e => e.key === 'Enter' && submit()} />
      <//>
      <${Field} label="סיסמה">
        <input type="password" class=${inputCls} value=${password} autoComplete="current-password"
               onChange=${e => setP(e.target.value)}
               onKeyDown=${e => e.key === 'Enter' && submit()} />
      <//>

      <div class="flex items-center justify-between">
        <label class="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
          <input type="checkbox" class="accent-brand-green w-4 h-4" checked=${remember}
                 onChange=${e => setRemember(e.target.checked)} />
          זכור אותי
        </label>
        <button class="text-sm text-zinc-500 hover:text-brand-green"
                onClick=${() => { setScreen('forgot'); setErr(''); setNote(''); }}>
          שכחתי סיסמה
        </button>
      </div>

      <${Btn} className="w-full" onClick=${submit} disabled=${busy}>
        ${busy ? 'מתחבר…' : 'כניסה'}
      <//>
    </div>`);
}

/* ============ Task card ============ */
function Card({ task, users, clients, counts, onOpen, onQuickMove, mobile, canEdit }) {
  const user = users.find(u => u.username === task.assignedTo);
  const client = clients.find(c => c.name === task.clientName);
  const late = isLate(task);
  const nC = counts.comments?.[task.id] || 0;
  const nF = counts.files?.[task.id] || 0;

  return html`
    <article draggable="true" onClick=${() => onOpen(task)}
      onDragStart=${e => e.dataTransfer.setData('text/plain', task.id)}
      class="bg-white border border-zinc-200 rounded-xl p-3 mb-2 cursor-grab hover:shadow-md hover:-translate-y-px transition"
      style=${{ borderInlineStartWidth: 3, borderInlineStartColor: PRIOS[task.priority].bar }}>

      <div class="font-medium leading-snug mb-2.5">${task.title}</div>

      <div class="flex items-center gap-1.5 flex-wrap">
        ${client && html`
          <span class="flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-lg text-white"
                style=${{ background: client.color }}>
            ${client.logoPath && html`
              <img src=${`./${client.logoPath}`} alt=""
                   class="w-4 h-4 rounded-sm object-contain bg-white/90 p-px" />`}
            ${client.name}
          </span>`}
        ${task.dueDate && html`
          <span class=${`text-[11px] px-2 py-0.5 rounded-lg border ${late
            ? 'text-red-600 border-red-200 bg-red-50 font-semibold'
            : 'text-zinc-500 border-zinc-200'}`}>${fmtDate(task.dueDate)}</span>`}
        ${task.visibleToClient == 1 && html`
          <span class="text-[11px] px-2 py-0.5 rounded-lg bg-brand-mint text-brand-green font-medium">גלוי ללקוח</span>`}
        <div class="mr-auto"><${Avatar} user=${user} size=${26} /></div>
      </div>

      ${(nC > 0 || nF > 0 || (mobile && canEdit)) && html`
        <div class="flex items-center gap-3 mt-2.5 pt-2 border-t border-zinc-100 text-[11px] text-zinc-500">
          ${nC > 0 && html`<span class="flex items-center gap-1"><${MessageSquare} size=${12} /> ${nC}</span>`}
          ${nF > 0 && html`<span class="flex items-center gap-1"><${Paperclip} size=${12} /> ${nF}</span>`}
          ${mobile && canEdit
            ? html`<button aria-label="העברת סטטוס"
                onClick=${e => { e.stopPropagation(); onQuickMove(task); }}
                class="mr-auto flex items-center gap-1 text-brand-green bg-brand-mint rounded-lg px-2 py-1 font-bold">
                <${ArrowRightLeft} size=${12} /> העבר
              </button>`
            : html`<span class="mr-auto">${PRIOS[task.priority].label}</span>`}
        </div>`}
    </article>`;
}

/* ============ Board ============ */
function Board({ tasks, users, clients, counts, canEdit, onOpen, onMove, mobile, onQuickMove }) {
  const [over, setOver] = useState(null);
  const [tab, setTab] = useState('todo');

  if (mobile) {
    const items = tasks.filter(t => t.status === tab);
    return html`
      <div class="pb-24">
        <div class="flex gap-2 px-4 pb-3 overflow-x-auto">
          ${COLS.map(col => {
            const n = tasks.filter(t => t.status === col.key).length;
            return html`
              <button key=${col.key} onClick=${() => setTab(col.key)}
                class=${`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm border transition ${
                  tab === col.key ? 'bg-brand-lime border-brand-green text-brand-green font-bold'
                                  : 'bg-white border-zinc-200 text-zinc-600'}`}>
                <span class="w-2 h-2 rounded-full" style=${{ background: col.color }}></span>
                ${col.label}
                <span class=${`rounded-full px-1.5 text-[11px] ${
                  tab === col.key ? 'bg-brand-green text-white' : 'bg-zinc-100 text-zinc-500'}`}>${n}</span>
              </button>`;
          })}
        </div>

        <div class="px-4">
          ${items.length
            ? items.map(t => html`<${Card} key=${t.id} task=${t} users=${users} clients=${clients}
                                          counts=${counts} onOpen=${onOpen} mobile=${true}
                                          canEdit=${canEdit} onQuickMove=${onQuickMove} />`)
            : html`<div class="text-sm text-zinc-400 text-center py-12">אין משימות בעמודה הזו</div>`}
        </div>
      </div>`;
  }

  return html`
    <div class="grid gap-3 px-5 pb-10" style=${{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
      ${COLS.map(col => {
        const items = tasks.filter(t => t.status === col.key);
        return html`
          <section key=${col.key}
            class=${`bg-white border rounded-2xl p-3 min-h-[180px] transition ${
              over === col.key ? 'border-brand-green bg-brand-mint/30' : 'border-zinc-200'}`}
            onDragOver=${e => { if (!canEdit) return; e.preventDefault(); setOver(col.key); }}
            onDragLeave=${() => setOver(null)}
            onDrop=${e => {
              e.preventDefault(); setOver(null);
              if (canEdit) onMove(e.dataTransfer.getData('text/plain'), col.key);
            }}>

            <div class="flex items-center gap-2 px-1 pb-3">
              <span class="w-2 h-2 rounded-full" style=${{ background: col.color }}></span>
              <span class="font-semibold text-sm">${col.label}</span>
              <span class="mr-auto text-xs font-semibold text-zinc-500 bg-zinc-100 rounded-full px-2 py-0.5">
                ${items.length}
              </span>
            </div>

            ${items.length
              ? items.map(t => html`<${Card} key=${t.id} task=${t} users=${users} clients=${clients}
                                             counts=${counts} onOpen=${onOpen} canEdit=${canEdit} />`)
              : html`<div class="text-xs text-zinc-400 text-center py-5">אין משימות</div>`}
          </section>`;
      })}
    </div>`;
}

/* ============ Task drawer ============ */
function Drawer({ task, users, clients, me, onClose, onSaved, mobile }) {
  const isNew = task.id === 'new';
  const canEdit = me.role === 'admin';
  const [f, setF] = useState({
    title: task.title || '', description: task.description || '',
    clientName: task.clientName || '', assignedTo: task.assignedTo || (canEdit ? me.username : ''),
    status: task.status || 'todo', priority: task.priority || 'normal',
    dueDate: task.dueDate || '',
    // משימה חדשה → גלויה ללקוח כברירת מחדל. משימה קיימת → כפי שנשמרה.
    visibleToClient: isNew ? true : task.visibleToClient == 1,
  });
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [files, setFiles] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [wa, setWa] = useState(null);   // null | 'client' | 'staff'
  const [internal, setInternal] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const loadSub = useCallback(async () => {
    if (isNew) return;
    const [c, a, fl] = await Promise.all([
      api('task_comments', { query: { taskId: task.id } }),
      api('task_activity', { query: { taskId: task.id } }),
      api('task_files',    { query: { taskId: task.id } }),
    ]);
    setComments(c); setActivity(a); setFiles(fl);
  }, [task.id, isNew]);

  useEffect(() => { loadSub(); }, [loadSub]);

  const save = async () => {
    if (!f.title.trim()) return;
    setBusy(true);
    try {
      await api('tasks', { method: 'POST', body: { ...(isNew ? {} : { id: task.id }), ...f,
        visibleToClient: f.visibleToClient ? 1 : 0 } });
      onSaved();
    } catch (e) { alert(e.message); setBusy(false); }
  };

  const remove = async () => {
    if (!confirm('למחוק את המשימה לצמיתות? כל התגובות והקבצים יימחקו איתה.')) return;
    await api('tasks', { method: 'DELETE', query: { id: task.id } });
    onSaved();
  };

  const send = async () => {
    if (!msg.trim()) return;
    await api('task_comments', { method: 'POST',
      body: { taskId: task.id, message: msg, internal: internal ? 1 : 0 } });
    setMsg(''); loadSub();
  };

  const saveEdit = async (id) => {
    if (!editText.trim()) return;
    try {
      await api('task_comments', { method: 'POST', body: { id, taskId: task.id, message: editText } });
      setEditId(null); loadSub();
    } catch (e) { alert(e.message); }
  };

  const removeComment = async (id) => {
    if (!confirm('למחוק את התגובה?')) return;
    try { await api('task_comments', { method: 'DELETE', query: { id } }); loadSub(); }
    catch (e) { alert(e.message); }
  };

  const upload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const form = new FormData();
    form.append('taskId', task.id); form.append('file', file);
    try { await api('task_files', { method: 'POST', form }); loadSub(); }
    catch (err) { alert(err.message); }
    e.target.value = '';
  };

  const logLine = (l) => {
    const lbl = k => COLS.find(c => c.key === k)?.label || k;
    if (l.field === 'created')    return `${l.actorName} יצר את המשימה`;
    if (l.field === 'status')     return `${l.actorName} העביר ל״${lbl(l.newValue)}״`;
    if (l.field === 'assignedTo') return `${l.actorName} שינה אחראי ל-${users.find(u => u.username === l.newValue)?.name || '—'}`;
    if (l.field === 'priority')   return `${l.actorName} שינה עדיפות ל-${PRIOS[l.newValue]?.label || l.newValue}`;
    if (l.field === 'dueDate')    return `${l.actorName} שינה דדליין ל-${fmtDate(l.newValue) || '—'}`;
    return `${l.actorName} עדכן ${l.field}`;
  };

  const client = clients.find(c => c.name === f.clientName);

  return html`
    <div class="fixed inset-0 z-40">
      <div class="absolute inset-0 bg-black/40" onClick=${onClose}></div>

      ${wa && html`<${WhatsAppModal} task=${{ ...task, ...f }} client=${client} mode=${wa}
                                     users=${users} onClose=${() => setWa(false)} />`}

      <aside class=${`absolute bg-white shadow-2xl flex flex-col ${
        mobile ? 'inset-0' : 'inset-y-0 start-0 w-full sm:w-[480px]'}`}>
        <header class="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-zinc-200">
          ${mobile && html`
            <button onClick=${onClose} aria-label="חזרה" class="p-1 -ms-1 text-zinc-500">
              <${ChevronLeft} size=${22} class="rotate-180" />
            </button>`}
          <b class="text-base">${isNew ? 'משימה חדשה' : 'פרטי משימה'}</b>
          ${!isNew && canEdit && html`
            <div class="flex gap-1.5 mr-auto">
              ${f.assignedTo && html`
                <button onClick=${() => setWa('staff')} title="התראה בוואטסאפ לעובד האחראי"
                  class="flex items-center gap-1.5 text-xs font-bold text-brand-green bg-brand-mint
                         hover:brightness-95 rounded-xl px-3 py-1.5">
                  <${Bell} size=${14} /> התרע לעובד
                </button>`}
              ${f.clientName && html`
                <button onClick=${() => setWa('client')}
                  class="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50
                         hover:bg-green-100 rounded-xl px-3 py-1.5">
                  <${MessageCircle} size=${14} /> עדכן לקוח
                </button>`}
            </div>`}
          <button class="mr-auto text-zinc-400 hover:text-zinc-700" onClick=${onClose}>
            <${X} size=${20} />
          </button>
        </header>

        <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          ${!isNew && canEdit && mobile && html`
            <div class="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
              ${COLS.map(c => html`
                <button key=${c.key} onClick=${() => set('status', c.key)}
                  class=${`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs border transition ${
                    f.status === c.key ? 'bg-brand-lime border-brand-green text-brand-green font-bold'
                                       : 'bg-white border-zinc-200 text-zinc-500'}`}>
                  <span class="w-2 h-2 rounded-full" style=${{ background: c.color }}></span>
                  ${c.label}
                </button>`)}
            </div>`}

          <${Field} label="כותרת">
            <input class=${inputCls} value=${f.title} disabled=${!canEdit} autoFocus
                   placeholder="מה צריך לעשות?" onChange=${e => set('title', e.target.value)} />
          <//>
          <${Field} label="תיאור">
            <textarea class=${`${inputCls} min-h-[80px] leading-relaxed`} value=${f.description}
                      disabled=${!canEdit} placeholder="פרטים, לינקים, הנחיות מהלקוח…"
                      onChange=${e => set('description', e.target.value)}></textarea>
          <//>

          <div class="grid grid-cols-2 gap-3">
            <${Field} label="לקוח">
              <select class=${inputCls} value=${f.clientName} disabled=${!canEdit}
                      onChange=${e => set('clientName', e.target.value)}>
                <option value="">—</option>
                ${clients.map(c => html`<option key=${c.id} value=${c.name}>${c.name}</option>`)}
              </select>
            <//>
            <${Field} label="אחראי">
              <select class=${inputCls} value=${f.assignedTo} disabled=${!canEdit}
                      onChange=${e => set('assignedTo', e.target.value)}>
                <option value="">—</option>
                ${users.filter(u => u.role === 'admin').map(u =>
                  html`<option key=${u.id} value=${u.username}>${u.name}${u.jobTitle ? ` · ${u.jobTitle}` : ''}</option>`)}
              </select>
            <//>
            <${Field} label="סטטוס">
              <select class=${inputCls} value=${f.status} disabled=${!canEdit}
                      onChange=${e => set('status', e.target.value)}>
                ${COLS.map(c => html`<option key=${c.key} value=${c.key}>${c.label}</option>`)}
              </select>
            <//>
            <${Field} label="עדיפות">
              <select class=${inputCls} value=${f.priority} disabled=${!canEdit}
                      onChange=${e => set('priority', e.target.value)}>
                ${Object.entries(PRIOS).map(([k, v]) => html`<option key=${k} value=${k}>${v.label}</option>`)}
              </select>
            <//>
          </div>

          <${Field} label="דדליין">
            <input type="date" class=${inputCls} value=${f.dueDate || ''} disabled=${!canEdit}
                   onChange=${e => set('dueDate', e.target.value)} />
          <//>

          ${canEdit && html`
            <label class="flex items-center gap-2.5 bg-zinc-50 rounded-xl px-3 py-2.5 cursor-pointer">
              <input type="checkbox" class="accent-brand-green w-4 h-4" checked=${f.visibleToClient}
                     onChange=${e => set('visibleToClient', e.target.checked)} />
              <span class="text-sm">הצג את המשימה ללקוח</span>
              <span class="mr-auto text-xs text-zinc-400">${f.visibleToClient ? 'הלקוח יראה את המשימה' : 'פנימי — הלקוח לא יראה'}</span>
            </label>`}

          ${!isNew && canEdit && html`
            <${Reminders} task=${{ ...task, ...f }} client=${client} users=${users} />`}

          ${!isNew && html`
            <div class="border-t border-zinc-200 pt-4">
              <h4 class="text-xs font-semibold text-zinc-500 mb-2">קבצים</h4>
              <div class="space-y-1.5">
                ${files.map(fl => html`
                  <div key=${fl.id} class="flex items-center gap-2 border border-zinc-200 rounded-xl px-3 py-2 text-xs">
                    <${Paperclip} size=${13} class="text-zinc-400" />
                    <a href=${`./${fl.filePath}`} target="_blank"
                       class="text-brand-green font-medium hover:underline truncate">${fl.fileName}</a>
                    ${canEdit && html`
                      <button class="mr-auto text-zinc-400 hover:text-red-600"
                        onClick=${async () => { await api('task_files', { method: 'DELETE', query: { id: fl.id } }); loadSub(); }}>
                        <${Trash2} size=${13} />
                      </button>`}
                  </div>`)}
                ${!files.length && html`<div class="text-xs text-zinc-400 py-1">אין קבצים</div>`}
              </div>
              ${canEdit && html`<input type="file" class="mt-2 text-xs text-zinc-500" onChange=${upload} />`}
            </div>

            <div class="border-t border-zinc-200 pt-4">
              <h4 class="text-xs font-semibold text-zinc-500 mb-3">עדכונים ותגובות</h4>
              <div class="space-y-3">
                ${comments.map(c => {
                  const u = users.find(x => x.username === c.senderUsername);
                  const mine = c.senderUsername === me.username;
                  const editing = editId === c.id;
                  return html`
                    <div key=${c.id} class="flex gap-2.5 group">
                      <${Avatar} user=${u || { name: c.senderName }} size=${28} />
                      <div class="flex-1 bg-zinc-50 rounded-xl px-3 py-2">
                        <div class="flex items-baseline gap-2">
                          <b class="text-xs">${c.senderName}</b>
                          <time class="text-[11px] text-zinc-400">${fmtStamp(c.createdAt)}</time>
                          ${c.editedAt && html`<span class="text-[10px] text-zinc-400">(נערך)</span>`}
                          <span class="mr-auto flex items-center gap-1">
                            ${canEdit && html`
                              <span class=${`text-[10px] px-1.5 py-0.5 rounded-md ${
                                c.internal == 1 ? 'bg-zinc-200 text-zinc-600' : 'bg-brand-mint text-brand-green'}`}>
                                ${c.internal == 1 ? 'פנימי' : 'גלוי ללקוח'}
                              </span>`}
                            ${!editing && mine && html`
                              <button aria-label="עריכה" onClick=${() => { setEditId(c.id); setEditText(c.message); }}
                                class="opacity-0 group-hover:opacity-100 transition p-1 rounded-md text-zinc-400 hover:text-zinc-700">
                                <${Pencil} size=${12} />
                              </button>`}
                            ${!editing && (mine || me.role === 'admin') && html`
                              <button aria-label="מחיקה" onClick=${() => removeComment(c.id)}
                                class="opacity-0 group-hover:opacity-100 transition p-1 rounded-md text-zinc-400 hover:text-red-600">
                                <${Trash2} size=${12} />
                              </button>`}
                          </span>
                        </div>

                        ${editing ? html`
                          <div class="mt-1.5 space-y-2">
                            <textarea class=${`${inputCls} text-sm min-h-[60px] bg-white`} value=${editText}
                                      autoFocus onChange=${e => setEditText(e.target.value)}
                                      onKeyDown=${e => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(c.id); }
                                        if (e.key === 'Escape') setEditId(null);
                                      }}></textarea>
                            <div class="flex gap-2">
                              <button onClick=${() => saveEdit(c.id)}
                                class="text-xs font-bold bg-brand-lime text-brand-green rounded-lg px-3 py-1.5">
                                שמירה
                              </button>
                              <button onClick=${() => setEditId(null)}
                                class="text-xs text-zinc-500 rounded-lg px-3 py-1.5 hover:bg-zinc-200">
                                ביטול
                              </button>
                            </div>
                          </div>`
                        : html`<p class="text-sm mt-0.5 whitespace-pre-wrap leading-relaxed">${c.message}</p>`}
                      </div>
                    </div>`;
                })}
                ${!comments.length && html`<div class="text-xs text-zinc-400">עדיין אין עדכונים</div>`}

                ${activity.slice(0, 5).map(l => html`
                  <div key=${l.id} class="text-[11px] text-zinc-400 border-s-2 border-zinc-100 ps-2.5 py-0.5">
                    ${logLine(l)} · ${fmtStamp(l.createdAt)}
                  </div>`)}
              </div>

              ${canEdit && html`
                <div class="flex gap-2 mt-3">
                  <button onClick=${() => setInternal(true)}
                    class=${`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition ${
                      internal ? 'bg-zinc-100 border-zinc-300 text-zinc-700 font-bold'
                               : 'border-zinc-200 text-zinc-400'}`}>
                    <${Lock} size=${12} /> פנימי לצוות
                  </button>
                  <button onClick=${() => setInternal(false)}
                    class=${`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition ${
                      !internal ? 'bg-brand-mint border-brand-green text-brand-green font-bold'
                                : 'border-zinc-200 text-zinc-400'}`}>
                    <${Eye} size=${12} /> גלוי ללקוח
                  </button>
                </div>`}

              <div class="flex gap-2 mt-2">
                <input class=${inputCls} value=${msg}
                       placeholder=${internal ? 'עדכון פנימי לצוות…' : 'הודעה שהלקוח יראה…'}
                       onChange=${e => setMsg(e.target.value)}
                       onKeyDown=${e => e.key === 'Enter' && send()} />
                <${Btn} variant="green" className="px-3" onClick=${send}><${Send} size=${16} /><//>
              </div>
            </div>`}
        </div>

        ${canEdit && html`
          <footer class="flex items-center gap-2 px-4 sm:px-5 py-3 border-t border-zinc-200
                         pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <${Btn} onClick=${save} disabled=${busy}>${busy ? 'שומר…' : 'שמירה'}<//>
            <${Btn} variant="ghost" onClick=${onClose}>ביטול<//>
            ${!isNew && html`
              <button class="mr-auto text-red-600 font-semibold text-sm px-3 py-2 rounded-xl hover:bg-red-50"
                      onClick=${remove}>מחיקה</button>`}
          </footer>`}
      </aside>
    </div>`;
}



/* ============ Notification bell ============ */
function Bell_({ feed, users, onOpenTask, onSeen }) {
  const [open, setOpen] = useState(false);
  const unread = feed?.unread || 0;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) onSeen();
  };

  return html`
    <div class="relative">
      <button onClick=${toggle} aria-label="עדכונים"
        class="relative p-2 rounded-xl hover:bg-zinc-100 text-zinc-600">
        <${Bell} size=${19} />
        ${unread > 0 && html`
          <span class="absolute -top-0.5 -end-0.5 bg-red-500 text-white text-[10px] font-bold
                       rounded-full px-1.5 border-2 border-white">${unread}</span>`}
      </button>

      ${open && html`
        <div class="fixed inset-0 z-30" onClick=${() => setOpen(false)}></div>
        <div class="absolute z-40 mt-2 start-0 w-[min(20rem,calc(100vw-2rem))] bg-white border border-zinc-200
                    rounded-2xl shadow-xl overflow-hidden">
          <div class="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
            <b class="text-sm">עדכוני צוות</b>
            <span class="mr-auto text-[11px] text-zinc-400">${feed?.updates?.length || 0} אחרונים</span>
          </div>

          <div class="max-h-96 overflow-y-auto">
            ${(feed?.updates || []).length === 0 && html`
              <div class="px-4 py-8 text-center text-xs text-zinc-400">אין עדכונים עדיין</div>`}

            ${(feed?.updates || []).map(u => {
              const author = users.find(x => x.username === u.senderUsername);
              return html`
                <button key=${u.id} onClick=${() => { setOpen(false); onOpenTask(u.taskId); }}
                  class=${`w-full text-start flex gap-2.5 px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50 transition ${
                    u.isNew == 1 ? 'bg-brand-mint/40' : ''}`}>
                  <${Avatar} user=${author || { name: u.senderName }} size=${28} />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline gap-1.5">
                      <b class="text-xs">${u.senderName}</b>
                      <time class="text-[10px] text-zinc-400">${fmtStamp(u.createdAt)}</time>
                      ${u.isNew == 1 && html`<span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-auto"></span>`}
                    </div>
                    <p class="text-xs text-zinc-600 truncate">${u.message}</p>
                    <p class="text-[11px] text-zinc-400 truncate">
                      ${u.taskTitle}${u.clientName ? ` · ${u.clientName}` : ''}
                    </p>
                  </div>
                </button>`;
            })}
          </div>
        </div>`}
    </div>`;
}

/* ============ WhatsApp send modal ============ */
function WhatsAppModal({ task, client, users, onClose, mode = 'client' }) {
  const assignee = users.find(u => u.username === task.assignedTo);
  const statusLabel = COLS.find(c => c.key === task.status)?.label || '';
  const fill = (tpl) => (tpl || '')
    .replace(/{task}/g,     task.title)
    .replace(/{client}/g,   task.clientName || '—')
    .replace(/{status}/g,   statusLabel)
    .replace(/{user}/g,     assignee?.name || '')
    .replace(/{due}/g,      task.dueDate ? fmtDate(task.dueDate) : 'ללא')
    .replace(/{priority}/g, PRIOS[task.priority]?.label || '');

  const [msg, setMsg] = useState('');
  const [channel, setChannel] = useState(
    mode === 'staff' ? 'staff' : (client?.waGroupId ? 'group' : 'phone'));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api('settings').then(s => {
      setSettings(s);
      setMsg(fill(mode === 'staff' ? s.waStaffTemplate : s.waTemplate) ||
             `המשימה "${task.title}" עודכנה לסטטוס: ${statusLabel}`);
    }).catch(() => setMsg(`המשימה "${task.title}"`));
  }, []);

  const [sendErr, setSendErr] = useState('');

  const send = async () => {
    setBusy(true); setSendErr('');
    try {
      await api('whatsapp_send', { method: 'POST', body: { taskId: task.id, channel, message: msg } });
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (e) { setSendErr(e.message); setBusy(false); }
  };

  const waLink = () => {
    const raw = mode === 'staff' ? (assignee?.phone || '') : (client?.phone || '');
    const phone = intlPhone(raw);
    window.open(phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return html`
    <div class="fixed inset-0 z-50 grid place-items-center p-4">
      <div class="absolute inset-0 bg-black/40" onClick=${onClose}></div>
      <div class="relative bg-white rounded-2xl p-5 w-full max-w-md space-y-4 shadow-2xl">
        <div class="flex items-center gap-2">
          <${MessageCircle} size=${18} class="text-green-600" />
          <b>${mode === 'staff' ? 'התראה לעובד האחראי' : 'שליחת עדכון ללקוח'}</b>
        </div>

        ${done ? html`
          <div class="bg-green-50 text-green-700 rounded-xl px-3 py-6 text-center text-sm">
            <${Check} size=${20} class="inline" /> ההודעה נשלחה
          </div>` : html`
          ${mode === 'staff' ? html`
            <div class="flex items-center gap-2.5 bg-zinc-50 rounded-xl px-3 py-2.5">
              <${Avatar} user=${assignee} size=${30} />
              <div>
                <div class="text-sm font-bold">${assignee?.name || '—'}</div>
                <div class="text-[11px] text-zinc-500" dir="ltr">
                  ${assignee?.phone ? '+' + intlPhone(assignee.phone) : 'לא הוגדר מספר טלפון'}
                </div>
              </div>
            </div>
            ${!assignee?.phone && html`
              <div class="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                לעובד הזה אין מספר טלפון. הוסף אותו במסך "צוות".
              </div>`}`
          : html`
            <div class="flex gap-2">
              <button onClick=${() => setChannel('group')} disabled=${!client?.waGroupId}
                class=${`flex-1 rounded-xl px-3 py-2 text-sm border transition ${
                  channel === 'group' ? 'bg-brand-lime border-brand-green text-brand-green font-bold'
                                      : 'border-zinc-200 text-zinc-600 disabled:opacity-40'}`}>
                קבוצת הלקוח
              </button>
              <button onClick=${() => setChannel('phone')} disabled=${!client?.phone}
                class=${`flex-1 rounded-xl px-3 py-2 text-sm border transition ${
                  channel === 'phone' ? 'bg-brand-lime border-brand-green text-brand-green font-bold'
                                      : 'border-zinc-200 text-zinc-600 disabled:opacity-40'}`}>
                מספר ישיר
              </button>
            </div>

            ${!client?.waGroupId && !client?.phone && html`
              <div class="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                ללקוח הזה לא הוגדרו מספר או מזהה קבוצה. הוסף אותם במסך "לקוחות".
              </div>`}`}

          <${Field} label="ההודעה">
            <textarea class=${`${inputCls} min-h-[110px] leading-relaxed`} value=${msg}
                      onChange=${e => setMsg(e.target.value)}></textarea>
          <//>

          ${sendErr && html`
            <div class="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5
                        leading-relaxed whitespace-pre-wrap" dir="auto">${sendErr}</div>`}

          <div class="flex gap-2">
            <${Btn} onClick=${send} disabled=${busy || (mode === 'staff'
              ? !assignee?.phone
              : (!client?.waGroupId && !client?.phone))}>
              ${busy ? 'שולח…' : 'שליחה'}
            <//>
            <${Btn} variant="ghost" onClick=${waLink}>
              <${ExternalLink} size=${14} class="inline ml-1" /> פתח בוואטסאפ
            <//>
            <${Btn} variant="ghost" className="mr-auto" onClick=${onClose}>ביטול<//>
          </div>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            "שליחה" עוברת דרך שער הוואטסאפ המחובר. "פתח בוואטסאפ" רק מכין את ההודעה — אתה שולח ידנית.
          </p>`}
      </div>
    </div>`;
}

/* ============ Settings ============ */
function SettingsScreen() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState('');
  const [log, setLog] = useState(null);
  const set = (k, v) => setS(p => ({ ...p, [k]: v }));

  const loadLog = () => api('notifications').then(setLog).catch(() => setLog([]));

  useEffect(() => {
    api('settings').then(setS).catch(() => setS({}));
    loadLog();
  }, []);
  if (!s) return html`<div class="px-5 text-sm text-zinc-400">טוען…</div>`;

  const save = async () => {
    try { await api('settings', { method: 'POST', body: s }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { alert(e.message); }
  };

  return html`
    <div class="px-4 sm:px-5 pb-24 sm:pb-10 max-w-lg space-y-4">
      <div class="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
        <div class="flex items-center gap-2">
          <${MessageCircle} size=${18} class="text-green-600" />
          <b>חיבור וואטסאפ</b>
          <label class="mr-auto flex items-center gap-2 text-sm">
            <input type="checkbox" class="accent-brand-green w-4 h-4" checked=${!!Number(s.waEnabled)}
                   onChange=${e => set('waEnabled', e.target.checked ? 1 : 0)} />
            פעיל
          </label>
        </div>

        <${Field} label="ספק">
          <select class=${inputCls} value=${s.waProvider || 'whapi'}
                  onChange=${e => set('waProvider', e.target.value)}>
            <option value="whapi">Whapi.Cloud</option>
            <option value="greenapi">Green API</option>
          </select>
        <//>
        <${Field} label="כתובת השרת (Base URL)">
          <input class=${inputCls} value=${s.waBaseUrl || ''} dir="ltr"
                 placeholder="https://gate.whapi.cloud"
                 onChange=${e => set('waBaseUrl', e.target.value)} />
        <//>
        <${Field} label=${s.waTokenSet ? 'טוקן (שמור — מלא רק כדי להחליף)' : 'טוקן'}>
          <input type="password" class=${inputCls} dir="ltr" value=${s.waToken || ''}
                 placeholder=${s.waTokenSet ? '••••••••••' : 'API token'}
                 onChange=${e => set('waToken', e.target.value)} />
        <//>
        ${s.waProvider === 'greenapi' && html`
          <${Field} label="Instance ID">
            <input class=${inputCls} dir="ltr" value=${s.waInstanceId || ''}
                   onChange=${e => set('waInstanceId', e.target.value)} />
          <//>`}
        <${Field} label="תבנית ההודעה ללקוח">
          <textarea class=${`${inputCls} min-h-[90px] leading-relaxed`} value=${s.waTemplate || ''}
                    onChange=${e => set('waTemplate', e.target.value)}></textarea>
        <//>
        <${Field} label="תבנית ההתראה לעובד">
          <textarea class=${`${inputCls} min-h-[120px] leading-relaxed`} value=${s.waStaffTemplate || ''}
                    onChange=${e => set('waStaffTemplate', e.target.value)}></textarea>
        <//>
        <p class="text-[11px] text-zinc-400 leading-relaxed">
          משתנים: <code>{task}</code> שם המשימה · <code>{client}</code> הלקוח · <code>{user}</code> האחראי ·
          <code>{status}</code> הסטטוס · <code>{due}</code> הדדליין · <code>{priority}</code> העדיפות
        </p>

        <div class="flex items-center gap-2 flex-wrap">
          <${Btn} onClick=${save}>שמירה<//>
          <${Btn} variant="ghost" onClick=${async () => {
            setStatus('בודק…');
            try {
              const r = await api('whatsapp_status');
              setStatus(r.connected ? `מחובר (${r.state})` : `לא מחובר (${r.state})`);
            } catch (e) { setStatus('שגיאה: ' + e.message); }
          }}>בדיקת חיבור<//>
          ${saved && html`<span class="text-sm text-green-600">נשמר</span>`}
          ${status && html`<span class="text-sm text-zinc-600">${status}</span>`}
        </div>
      </div>

      <div class="bg-white border border-zinc-200 rounded-2xl p-5">
        <div class="flex items-center gap-2 mb-3">
          <${Send} size=${16} class="text-zinc-500" />
          <b>יומן שליחות</b>
          <button onClick=${loadLog} class="mr-auto text-xs text-zinc-500 hover:text-zinc-800 flex items-center gap-1">
            <${RefreshCw} size=${13} /> רענון
          </button>
        </div>

        ${log === null && html`<div class="text-xs text-zinc-400 py-2">טוען…</div>`}
        ${log?.length === 0 && html`<div class="text-xs text-zinc-400 py-2">עדיין לא נשלחו הודעות</div>`}

        <div class="space-y-2">
          ${(log || []).map(n => html`
            <div key=${n.id} class="border border-zinc-100 rounded-xl px-3 py-2.5">
              <div class="flex items-center gap-2 mb-1">
                <span class=${`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  n.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  ${n.status === 'sent' ? 'נשלח' : 'נכשל'}
                </span>
                <b class="text-xs">${n.clientName || '—'}</b>
                <span class="text-[11px] text-zinc-400">
                  ${n.channel === 'group' ? 'קבוצה' : 'מספר ישיר'}
                </span>
                <time class="mr-auto text-[11px] text-zinc-400">${fmtStamp(n.createdAt)}</time>
              </div>
              <p class="text-xs text-zinc-600 line-clamp-2 whitespace-pre-wrap">${n.message}</p>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-[10px] text-zinc-400">נשלח ע״י ${n.sentBy}</span>
                ${n.status !== 'sent' && n.response && html`
                  <span class="text-[10px] text-red-500 truncate" dir="ltr">${n.response}</span>`}
              </div>
            </div>`)}
        </div>
      </div>

      <div class="text-xs text-zinc-500 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 leading-relaxed">
        השליחה מתבצעת דרך שער לא-רשמי המחובר למספר וואטסאפ אמיתי בסריקת QR.
        חבר מספר ייעודי של המשרד, לא נייד אישי, ושלח רק ידנית ובקצב סביר.
      </div>
    </div>`;
}


/* ============ Reminders ============ */
function Reminders({ task, client, users, onChanged }) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const assignee = users.find(u => u.username === task.assignedTo);

  // ברירת מחדל: מחר ב-09:00
  const defaultWhen = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  };

  const [form, setForm] = useState({
    target: 'staff', nextRunAt: defaultWhen(), repeatEvery: 0, repeatTimes: 1, message: '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try { setList(await api('reminders', { query: { taskId: task.id } })); } catch {}
  }, [task.id]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      await api('reminders', { method: 'POST', body: {
        taskId: task.id, target: form.target,
        nextRunAt: form.nextRunAt.replace('T', ' '),
        repeatEvery: Number(form.repeatEvery) || 0,
        repeatTimes: Number(form.repeatTimes) || 1,
        message: form.message,
      }});
      setOpen(false); setForm(f => ({ ...f, message: '' })); load(); onChanged?.();
    } catch (e) { alert(e.message); }
  };

  const remove = async (id) => {
    await api('reminders', { method: 'DELETE', query: { id } });
    load();
  };

  const targetLabel = (t) => t === 'staff' ? `לעובד (${assignee?.name || '—'})`
                          : t === 'group' ? 'לקבוצת הלקוח' : 'למספר הלקוח';

  const preset = (label, hours, times) => html`
    <button onClick=${() => {
      const d = new Date(); d.setHours(d.getHours() + hours, 0, 0, 0);
      setForm(f => ({ ...f, nextRunAt: new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16), repeatEvery: times > 1 ? 24 : 0, repeatTimes: times }));
    }} class="text-[11px] border border-zinc-200 rounded-lg px-2 py-1 hover:bg-zinc-50">
      ${label}
    </button>`;

  return html`
    <div class="border-t border-zinc-200 pt-4">
      <div class="flex items-center gap-2 mb-2.5">
        <${AlarmClock} size=${15} class="text-zinc-500" />
        <h4 class="text-xs font-bold text-zinc-500">תזכורות בוואטסאפ</h4>
        <button onClick=${() => setOpen(v => !v)}
          class="mr-auto text-xs font-bold text-brand-green bg-brand-mint rounded-lg px-2.5 py-1">
          ${open ? 'ביטול' : '+ תזכורת'}
        </button>
      </div>

      ${list.length === 0 && !open && html`
        <div class="text-xs text-zinc-400">אין תזכורות מתוזמנות</div>`}

      <div class="space-y-1.5">
        ${list.map(r => html`
          <div key=${r.id} class=${`flex items-center gap-2 border rounded-xl px-3 py-2 text-xs ${
            r.active == 1 ? 'border-zinc-200' : 'border-zinc-100 bg-zinc-50 text-zinc-400'}`}>
            <${AlarmClock} size=${13} class="text-zinc-400 shrink-0" />
            <div class="min-w-0">
              <div class="font-bold">${fmtStamp(r.nextRunAt)}</div>
              <div class="text-[11px] text-zinc-500 flex items-center gap-1.5 flex-wrap">
                <span>${targetLabel(r.target)}</span>
                ${r.repeatEvery > 0 && html`
                  <span class="flex items-center gap-0.5">
                    <${Repeat} size=${10} /> כל ${r.repeatEvery} שעות · ${r.sentCount}/${r.repeatTimes}
                  </span>`}
                ${r.active != 1 && html`<span>· הסתיימה</span>`}
              </div>
            </div>
            <button onClick=${() => remove(r.id)}
              class="mr-auto text-zinc-400 hover:text-red-600 shrink-0"><${Trash2} size=${13} /></button>
          </div>`)}
      </div>

      ${open && html`
        <div class="mt-3 bg-zinc-50 rounded-xl p-3 space-y-3">
          <div class="flex gap-1.5 flex-wrap">
            ${preset('בעוד שעה', 1, 1)}
            ${preset('מחר', 24, 1)}
            ${preset('כל יום × 3', 24, 3)}
            ${preset('כל יום × 7', 24, 7)}
          </div>

          <${Field} label="מתי לשלוח">
            <input type="datetime-local" class=${`${inputCls} bg-white`} value=${form.nextRunAt}
                   onChange=${e => set('nextRunAt', e.target.value)} />
          <//>

          <${Field} label="למי">
            <select class=${`${inputCls} bg-white`} value=${form.target}
                    onChange=${e => set('target', e.target.value)}>
              <option value="staff" disabled=${!assignee?.phone}>
                לעובד האחראי${assignee ? ` · ${assignee.name}` : ''}${!assignee?.phone ? ' (אין טלפון)' : ''}
              </option>
              <option value="group" disabled=${!client?.waGroupId}>
                לקבוצת הלקוח${!client?.waGroupId ? ' (לא מוגדרת)' : ''}
              </option>
              <option value="phone" disabled=${!client?.phone}>
                למספר הלקוח${!client?.phone ? ' (לא מוגדר)' : ''}
              </option>
            </select>
          <//>

          <div class="grid grid-cols-2 gap-2">
            <${Field} label="חזרה כל (שעות)">
              <input type="number" min="0" max="168" class=${`${inputCls} bg-white`}
                     value=${form.repeatEvery} placeholder="0 = חד־פעמי"
                     onChange=${e => set('repeatEvery', e.target.value)} />
            <//>
            <${Field} label="כמה פעמים">
              <input type="number" min="1" max="20" class=${`${inputCls} bg-white`}
                     value=${form.repeatTimes} disabled=${Number(form.repeatEvery) === 0}
                     onChange=${e => set('repeatTimes', e.target.value)} />
            <//>
          </div>

          <${Field} label="הודעה (ריק = תבנית ברירת המחדל)">
            <textarea class=${`${inputCls} bg-white min-h-[60px] text-xs`} value=${form.message}
                      placeholder="תזכורת: {task} · דדליין {due}"
                      onChange=${e => set('message', e.target.value)}></textarea>
          <//>

          <${Btn} className="w-full text-sm" onClick=${save}>קביעת תזכורת<//>
          <p class="text-[10px] text-zinc-400 leading-relaxed">
            התזכורת נעצרת אוטומטית ברגע שהמשימה מסומנת כ״בוצע״.
          </p>
        </div>`}
    </div>`;
}

/* ============ Team / Clients management ============ */
function TeamScreen({ users, onChange }) {
  const blank = { username: '', name: '', jobTitle: '', password: '', role: 'admin',
                  color: AVATAR_COLORS[0], businessName: '' };
  const [edit, setEdit] = useState(null);
  const set = (k, v) => setEdit(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!edit.username.trim() || !edit.name.trim()) return alert('נא למלא שם ושם משתמש');
    if (!edit.id && !edit.password) return alert('נא לקבוע סיסמה למשתמש החדש');
    try { await api('users', { method: 'POST', body: edit }); setEdit(null); onChange(); }
    catch (e) { alert(e.message); }
  };
  const remove = async (u) => {
    if (!confirm(`להסיר את ${u.name} מהמערכת?`)) return;
    try { await api('users', { method: 'DELETE', query: { id: u.id } }); onChange(); }
    catch (e) { alert(e.message); }
  };

  const group = (role, title) => html`
    <div class="mb-8">
      <h3 class="font-semibold mb-3">${title}</h3>
      <div class="space-y-2">
        ${users.filter(u => u.role === role).map(u => html`
          <div key=${u.id} class="flex items-center gap-3 bg-white border border-zinc-200 rounded-xl px-4 py-3">
            <${Avatar} user=${u} size=${34} />
            <div>
              <div class="font-medium text-sm">${u.name}</div>
              <div class="text-xs text-zinc-500 flex gap-2">
                <span>${u.jobTitle || u.businessName || '—'} · ${u.username}</span>
                ${u.phone
                  ? html`<span class="text-green-600">וואטסאפ מחובר</span>`
                  : html`<span class="text-amber-600">אין טלפון</span>`}
              </div>
            </div>
            <div class="mr-auto flex gap-1">
              <button class="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500"
                      onClick=${() => setEdit({ ...u, password: '' })}><${Pencil} size=${15} /></button>
              <button class="p-2 rounded-lg hover:bg-red-50 text-red-500"
                      onClick=${() => remove(u)}><${Trash2} size=${15} /></button>
            </div>
          </div>`)}
      </div>
    </div>`;

  return html`
    <div class="px-4 sm:px-5 pb-24 sm:pb-10 max-w-2xl">
      <div class="flex items-center gap-2 mb-5">
        <${Btn} onClick=${() => setEdit({ ...blank })}><${Plus} size=${16} class="inline -mt-0.5 ml-1" /> משתמש חדש<//>
      </div>

      ${group('admin', 'צוות המשרד')}
      ${group('client', 'לקוחות עם גישה')}

      ${edit && html`
        <div class="fixed inset-0 z-50 grid place-items-center p-4">
          <div class="absolute inset-0 bg-black/40" onClick=${() => setEdit(null)}></div>
          <div class="relative bg-white rounded-2xl p-5 w-full max-w-md space-y-4 shadow-2xl">
            <b>${edit.id ? 'עריכת משתמש' : 'משתמש חדש'}</b>

            <div class="grid grid-cols-2 gap-3">
              <${Field} label="שם מלא">
                <input class=${inputCls} value=${edit.name} onChange=${e => set('name', e.target.value)} />
              <//>
              <${Field} label="שם משתמש">
                <input class=${inputCls} value=${edit.username} onChange=${e => set('username', e.target.value)} />
              <//>
              <${Field} label="סוג">
                <select class=${inputCls} value=${edit.role} onChange=${e => set('role', e.target.value)}>
                  <option value="admin">עובד</option>
                  <option value="client">לקוח</option>
                </select>
              <//>
              ${edit.role === 'admin'
                ? html`<${Field} label="תפקיד">
                    <input class=${inputCls} value=${edit.jobTitle || ''} placeholder="קופי / גרפיקה / מדיה…"
                           onChange=${e => set('jobTitle', e.target.value)} />
                  <//>`
                : html`<${Field} label="שם העסק">
                    <input class=${inputCls} value=${edit.businessName || ''}
                           placeholder="חייב להתאים לשם הלקוח"
                           onChange=${e => set('businessName', e.target.value)} />
                  <//>`}
              <${Field} label=${edit.id ? 'סיסמה חדשה (ריק = ללא שינוי)' : 'סיסמה'}>
                <input type="password" class=${inputCls} value=${edit.password || ''}
                       onChange=${e => set('password', e.target.value)} />
              <//>
              <${Field} label="טלפון וואטסאפ">
                <input class=${inputCls} dir="ltr" value=${edit.phone || ''} placeholder="050-000-0000"
                       onChange=${e => set('phone', e.target.value)} />
              <//>
              <${Field} label="אימייל">
                <input class=${inputCls} value=${edit.email || ''} onChange=${e => set('email', e.target.value)} />
              <//>
            </div>

            <${Field} label="צבע אווטאר">
              <${ColorPicker} value=${edit.color} onChange=${v => set('color', v)} />
            <//>

            <div class="flex gap-2 pt-1">
              <${Btn} onClick=${save}>שמירה<//>
              <${Btn} variant="ghost" onClick=${() => setEdit(null)}>ביטול<//>
            </div>
          </div>
        </div>`}
    </div>`;
}

function ClientsScreen({ clients, onChange }) {
  const [edit, setEdit] = useState(null);
  const [groups, setGroups] = useState(null);
  const [loadingG, setLoadingG] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const set = (k, v) => setEdit(p => ({ ...p, [k]: v }));

  const uploadLogo = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUpBusy(true);
    const form = new FormData();
    form.append('file', file);
    if (edit.logoPath) form.append('oldPath', edit.logoPath);
    try {
      const r = await api('client_logo', { method: 'POST', form });
      set('logoPath', r.logoPath);
    } catch (err) { alert(err.message); }
    setUpBusy(false);
    e.target.value = '';
  };

  const loadGroups = async () => {
    setLoadingG(true);
    try { const r = await api('whatsapp_groups'); setGroups(r.groups || []); }
    catch (e) { alert(e.message); }
    setLoadingG(false);
  };

  const save = async () => {
    if (!edit.name.trim()) return alert('נא למלא שם לקוח');
    try { await api('clients', { method: 'POST', body: edit }); setEdit(null); onChange(); }
    catch (e) { alert(e.message); }
  };
  const remove = async (c) => {
    if (!confirm(`להסיר את ${c.name}? המשימות הקיימות יישארו.`)) return;
    await api('clients', { method: 'DELETE', query: { id: c.id } }); onChange();
  };

  return html`
    <div class="px-4 sm:px-5 pb-24 sm:pb-10 max-w-2xl">
      <div class="mb-5">
        <${Btn} onClick=${() => setEdit({ name: '', color: AVATAR_COLORS[0], contact: '' })}>
          <${Plus} size=${16} class="inline -mt-0.5 ml-1" /> לקוח חדש
        <//>
      </div>

      <div class="space-y-2">
        ${clients.map(c => html`
          <div key=${c.id} class="flex items-center gap-3 bg-white border border-zinc-200 rounded-xl px-4 py-3">
            ${c.logoPath
              ? html`<img src=${`./${c.logoPath}`} alt=${c.name}
                       class="w-9 h-9 rounded-lg object-contain bg-white border border-zinc-100 p-0.5" />`
              : html`<span class="w-9 h-9 rounded-lg grid place-items-center text-white text-xs font-bold"
                       style=${{ background: c.color }}>${initials(c.name)}</span>`}
            <div>
              <div class="font-medium text-sm">${c.name}</div>
              <div class="text-xs text-zinc-500 flex gap-2">
                ${c.contact && html`<span>${c.contact}</span>`}
                ${c.phone && html`<span dir="ltr">${c.phone}</span>`}
                ${c.waGroupId && html`<span class="text-green-600">קבוצה מחוברת</span>`}
                ${c.metaPageId && html`<span class="text-[#1877f2] flex items-center gap-0.5"><${Facebook} size=${10}/> פייסבוק</span>`}
              </div>
            </div>
            <div class="mr-auto flex gap-1">
              <button class="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500"
                      onClick=${() => setEdit({ ...c })}><${Pencil} size=${15} /></button>
              <button class="p-2 rounded-lg hover:bg-red-50 text-red-500"
                      onClick=${() => remove(c)}><${Trash2} size=${15} /></button>
            </div>
          </div>`)}
      </div>

      ${edit && html`
        <div class="fixed inset-0 z-50 grid place-items-center p-4">
          <div class="absolute inset-0 bg-black/40" onClick=${() => setEdit(null)}></div>
          <div class="relative bg-white rounded-2xl p-5 w-full max-w-md space-y-4 shadow-2xl
                      max-h-[90vh] overflow-y-auto">
            <b>${edit.id ? 'עריכת לקוח' : 'לקוח חדש'}</b>
            <${Field} label="שם הלקוח">
              <input class=${inputCls} value=${edit.name} autoFocus onChange=${e => set('name', e.target.value)} />
            <//>
            <${Field} label="איש קשר">
              <input class=${inputCls} value=${edit.contact || ''} onChange=${e => set('contact', e.target.value)} />
            <//>
            <${Field} label="טלפון וואטסאפ">
              <input class=${inputCls} dir="ltr" value=${edit.phone || ''} placeholder="050-000-0000"
                     onChange=${e => set('phone', e.target.value)} />
            <//>
            <${Field} label="קבוצת וואטסאפ">
              ${groups ? html`
                <select class=${inputCls} value=${edit.waGroupId || ''}
                        onChange=${e => set('waGroupId', e.target.value)}>
                  <option value="">— ללא קבוצה —</option>
                  ${groups.map(g => html`<option key=${g.id} value=${g.id}>${g.name}</option>`)}
                </select>`
              : html`
                <div class="flex gap-2">
                  <input class=${inputCls} dir="ltr" value=${edit.waGroupId || ''}
                         placeholder="120363...@g.us"
                         onChange=${e => set('waGroupId', e.target.value)} />
                  <button onClick=${loadGroups} disabled=${loadingG}
                    class="whitespace-nowrap text-xs font-bold bg-brand-lime text-brand-green rounded-xl px-3">
                    ${loadingG ? 'טוען…' : 'משוך קבוצות'}
                  </button>
                </div>`}
            <//>
            <${Field} label="לוגו">
              <div class="flex items-center gap-3">
                ${edit.logoPath
                  ? html`<img src=${`./${edit.logoPath}`} alt="לוגו"
                           class="w-16 h-16 rounded-xl object-contain bg-white border border-zinc-200 p-1" />`
                  : html`<div class="w-16 h-16 rounded-xl grid place-items-center text-white font-bold border border-zinc-200"
                           style=${{ background: edit.color || '#013d19' }}>${initials(edit.name) || '?'}</div>`}

                <div class="flex-1 space-y-1.5">
                  <label class="block">
                    <span class="inline-block text-xs font-bold bg-zinc-100 hover:bg-zinc-200
                                 rounded-xl px-3 py-2 cursor-pointer transition">
                      ${upBusy ? 'מעלה…' : (edit.logoPath ? 'החלפת לוגו' : 'העלאת לוגו')}
                    </span>
                    <input type="file" class="hidden" accept="image/*" onChange=${uploadLogo} />
                  </label>
                  ${edit.logoPath && html`
                    <button onClick=${() => set('logoPath', '')}
                      class="block text-xs text-zinc-400 hover:text-red-600">הסרת הלוגו</button>`}
                  <p class="text-[10px] text-zinc-400">PNG · JPG · SVG · עד 3MB</p>
                </div>
              </div>
            <//>

            <${Field} label="צבע">
              <${ColorPicker} value=${edit.color} onChange=${v => set('color', v)} />
            <//>

            ${edit.id && html`
              <${Field} label="חיבור פייסבוק">
                <${MetaConnect} client=${edit} onChanged=${() => { onChange(); setEdit(null); }} />
              <//>`}

            <div class="flex gap-2 pt-1">
              <${Btn} onClick=${save}>שמירה<//>
              <${Btn} variant="ghost" onClick=${() => setEdit(null)}>ביטול<//>
            </div>
          </div>
        </div>`}
    </div>`;
}



/* ============ Meta (Facebook) connect ============ */
function MetaConnect({ client, onChanged }) {
  const [pages, setPages] = useState(null);   // null=לא בתהליך, []=נטען
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null);
  const connected = !!client.metaPageId;

  // מאזין להודעה מחלון ה-OAuth שנסגר
  useEffect(() => {
    const onMsg = async (e) => {
      if (e.data === 'meta_done') { setLoading(true); await loadPages(); }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const connect = async () => {
    try {
      const { url } = await api('meta_connect', { query: { clientName: client.name } });
      window.open(url, 'meta_oauth', 'width=600,height=700');
    } catch (e) { alert(e.message); }
  };

  const loadPages = async () => {
    try {
      const r = await api('meta_pages');
      setPages(r.pages || []);
    } catch (e) { alert(e.message); setPages(null); }
    setLoading(false);
  };

  const savePage = async () => {
    if (!sel) return;
    try {
      await api('meta_save_page', { method: 'POST', body: {
        pageId: sel.id, pageName: sel.name, pageToken: sel.token, adAccount: sel.adAccount || '',
      }});
      setPages(null); onChanged?.();
    } catch (e) { alert(e.message); }
  };

  const disconnect = async () => {
    if (!confirm(`לנתק את הדף של ${client.name} מפייסבוק?`)) return;
    await api('meta_disconnect', { method: 'POST', body: { clientName: client.name } });
    onChanged?.();
  };

  if (connected) return html`
    <div class="border border-green-200 bg-green-50 rounded-xl p-3">
      <div class="flex items-center gap-2">
        <${Facebook} size=${18} class="text-[#1877f2]" />
        <div class="min-w-0">
          <div class="text-sm font-bold">${client.metaPageName || 'דף מחובר'}</div>
          <div class="text-[11px] text-green-700">מחובר · נתונים נמשכים אוטומטית</div>
        </div>
        <button onClick=${disconnect} class="mr-auto text-zinc-400 hover:text-red-600 flex items-center gap-1 text-xs">
          <${Unlink} size=${13} /> ניתוק
        </button>
      </div>
    </div>`;

  if (pages) return html`
    <div class="border border-zinc-200 rounded-xl p-3 space-y-2">
      <div class="text-xs font-bold text-zinc-600">בחר את הדף העסקי לחיבור:</div>
      ${loading && html`<div class="text-xs text-zinc-400">טוען דפים…</div>`}
      ${pages.map(p => html`
        <button key=${p.id} onClick=${() => setSel(p)}
          class=${`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-start border transition ${
            sel?.id === p.id ? 'bg-brand-lime border-brand-green' : 'border-zinc-200 hover:bg-zinc-50'}`}>
          <${Facebook} size=${15} class="text-[#1877f2]" />
          <div>
            <div class="text-sm font-medium">${p.name}</div>
            ${p.category && html`<div class="text-[10px] text-zinc-400">${p.category}</div>`}
          </div>
          ${sel?.id === p.id && html`<${Check} size=${15} class="mr-auto text-brand-green" />`}
        </button>`)}
      ${!pages.length && html`<div class="text-xs text-amber-700">לא נמצאו דפים. ודא שיש לך גישת ניהול לדף.</div>`}
      <div class="flex gap-2 pt-1">
        <${Btn} className="text-sm" onClick=${savePage} disabled=${!sel}>שמירת הדף<//>
        <${Btn} variant="ghost" className="text-sm" onClick=${() => setPages(null)}>ביטול<//>
      </div>
    </div>`;

  return html`
    <button onClick=${connect}
      class="w-full flex items-center justify-center gap-2 bg-[#1877f2] text-white font-bold
             rounded-xl px-4 py-2.5 hover:brightness-110 transition">
      <${Facebook} size=${18} /> התחברות לפייסבוק
    </button>
    <p class="text-[10px] text-zinc-400 mt-1.5 text-center leading-relaxed">
      פותח חלון של פייסבוק לבחירת דף עסקי. לאחר החיבור, לידים ונתוני קמפיין יימשכו אוטומטית.
    </p>`;
}

/* ============ Timeline ============ */
const TL_TYPES = {
  post:     { label: 'פוסט',     icon: FileText,     color: '#3b82f6' },
  campaign: { label: 'קמפיין',   icon: Target,       color: '#8b5cf6' },
  task:     { label: 'בוצע',     icon: CheckCircle2, color: '#10b981' },
  update:   { label: 'עדכון',    icon: MsgIcon,      color: '#f59e0b' },
  note:     { label: 'הערה',     icon: Activity,     color: '#64748b' },
  status:   { label: 'בתהליך',   icon: AlarmClock,   color: '#0ea5e9' },
};
const TASK_STATUS = {
  todo:        { label: 'ממתין',  color: '#94a3b8' },
  in_progress: { label: 'בעבודה', color: '#0ea5e9' },
  review:      { label: 'בבדיקה', color: '#f59e0b' },
  done:        { label: 'הושלם',  color: '#10b981' },
};
const monthLabel = (ym) => {
  const [y, m] = ym.split('-');
  const names = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return `${names[+m - 1]} ${y}`;
};
const nis = (n) => '₪' + Number(n || 0).toLocaleString('he-IL');
const num = (n) => Number(n || 0).toLocaleString('he-IL');

function StatCard({ icon, label, value, tint }) {
  return html`
    <div class="bg-white border border-zinc-200 rounded-xl p-3 flex items-center gap-3">
      <div class="w-9 h-9 rounded-lg grid place-items-center shrink-0"
           style=${{ background: tint + '18', color: tint }}>${icon}</div>
      <div class="min-w-0">
        <div class="text-lg font-bold leading-none">${value}</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">${label}</div>
      </div>
    </div>`;
}

function Timeline({ clientName, isClient, users, clients, onManage }) {
  const [data, setData] = useState({ events: [], summary: {} });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = isClient ? {} : { clientName: clientName || '' };
      setData(await api('timeline', { query: q }));
    } catch {} 
    setLoading(false);
  }, [clientName, isClient]);
  useEffect(() => { load(); }, [load]);

  const client = clients?.find(c => c.name === (isClient ? clientName : clientName));

  // קיבוץ אירועים לפי חודש
  const byMonth = {};
  for (const e of data.events) {
    const m = (e.eventDate || '').slice(0, 7);
    (byMonth[m] ||= []).push(e);
  }
  const months = Object.keys(byMonth).sort().reverse();

  if (loading) return html`<div class="px-5 py-10 text-center text-sm text-zinc-400">טוען טיימליין…</div>`;

  if (!isClient && !clientName) return html`
    <div class="px-5 py-16 text-center text-sm text-zinc-400">
      בחר לקוח כדי לראות את הטיימליין שלו
    </div>`;

  return html`
    <div class="px-4 sm:px-5 pb-24 sm:pb-10 max-w-3xl">
      ${!data.events.length && html`
        <div class="text-center py-16">
          <${Activity} size=${32} class="mx-auto text-zinc-300 mb-3" />
          <p class="text-sm text-zinc-400">עדיין אין פעילות בטיימליין</p>
          ${!isClient && html`
            <button onClick=${onManage}
              class="mt-3 text-sm font-bold text-brand-green bg-brand-mint rounded-xl px-4 py-2">
              הוספת פעילות
            </button>`}
        </div>`}

      ${months.map(m => {
        const sum = data.summary[m] || {};
        const evs = byMonth[m];
        const hasMetrics = sum.leads || sum.reach || sum.clicks || sum.spend;
        return html`
          <div key=${m} class="mb-8">
            <div class="flex items-center gap-2 mb-3 sticky top-0 bg-zinc-50/80 backdrop-blur py-1.5 z-10">
              <h3 class="font-bold text-base">${monthLabel(m)}</h3>
              <span class="text-xs text-zinc-400">${evs.length} פעילויות</span>
            </div>

            ${hasMetrics ? html`
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                ${sum.leads ? html`<${StatCard} icon=${html`<${Target} size=${17}/>`}
                   label="לידים" value=${num(sum.leads)} tint="#8b5cf6" />` : ''}
                ${sum.reach ? html`<${StatCard} icon=${html`<${TrendingUp} size=${17}/>`}
                   label="חשיפות" value=${num(sum.reach)} tint="#3b82f6" />` : ''}
                ${sum.clicks ? html`<${StatCard} icon=${html`<${Activity} size=${17}/>`}
                   label="קליקים" value=${num(sum.clicks)} tint="#10b981" />` : ''}
                ${sum.spend ? html`<${StatCard} icon=${html`<${DollarSign} size=${17}/>`}
                   label="הוצא" value=${nis(sum.spend)} tint="#f59e0b" />` : ''}
              </div>` : ''}

            <div class="relative ps-5">
              <div class="absolute top-1 bottom-1 start-[7px] w-px bg-zinc-200"></div>
              ${evs.map(e => {
                const t = TL_TYPES[e.type] || TL_TYPES.note;
                return html`
                  <div key=${e.id} class="relative mb-4">
                    <div class="absolute -start-5 top-1 w-3.5 h-3.5 rounded-full border-2 border-white"
                         style=${{ background: t.color }}></div>
                    <div class="bg-white border border-zinc-200 rounded-xl p-3.5">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-[11px] font-bold px-2 py-0.5 rounded-md"
                              style=${{ background: t.color + '18', color: t.color }}>${t.label}</span>
                        ${e.platform && html`<span class="text-[11px] text-zinc-400">${e.platform}</span>`}
                        <time class="mr-auto text-[11px] text-zinc-400">
                          ${new Date(e.eventDate).toLocaleDateString('he-IL', {day:'numeric',month:'short'})}
                        </time>
                        ${!isClient && html`
                          <button onClick=${async () => { await api('timeline',{method:'DELETE',query:{id:e.id}}); load(); }}
                            class="text-zinc-300 hover:text-red-500"><${Trash2} size=${13}/></button>`}
                      </div>
                      <div class="font-bold text-sm">${e.title}</div>
                      ${e.body && html`<p class="text-xs text-zinc-600 mt-1 leading-relaxed whitespace-pre-wrap">${e.body}</p>`}

                      ${e.type === 'status' && e.status && html`
                        <div class="flex items-center gap-2 mt-1.5">
                          <span class="text-[11px] font-bold px-2 py-0.5 rounded-md"
                                style=${{ background: (TASK_STATUS[e.status]?.color || '#94a3b8') + '18',
                                          color: TASK_STATUS[e.status]?.color || '#94a3b8' }}>
                            ${TASK_STATUS[e.status]?.label || e.status}
                          </span>
                          ${e.dueDate && html`
                            <span class="text-[11px] text-zinc-400">
                              יעד: ${new Date(e.dueDate).toLocaleDateString('he-IL',{day:'numeric',month:'short'})}
                            </span>`}
                        </div>`}

                      ${(e.metricLeads || e.metricReach || e.metricClicks || e.metricSpend) && html`
                        <div class="flex gap-3 mt-2 pt-2 border-t border-zinc-100 text-[11px]">
                          ${e.metricLeads ? html`<span><b>${num(e.metricLeads)}</b> לידים</span>`:''}
                          ${e.metricReach ? html`<span><b>${num(e.metricReach)}</b> חשיפות</span>`:''}
                          ${e.metricClicks? html`<span><b>${num(e.metricClicks)}</b> קליקים</span>`:''}
                          ${e.metricSpend ? html`<span><b>${nis(e.metricSpend)}</b></span>`:''}
                        </div>`}

                      ${e.linkUrl && html`
                        <a href=${e.linkUrl} target="_blank"
                           class="inline-flex items-center gap-1 text-[11px] text-brand-green font-bold mt-2 hover:underline">
                          <${LinkIcon} size=${11}/> צפייה
                        </a>`}
                    </div>
                  </div>`;
              })}
            </div>
          </div>`;
      })}
    </div>`;
}


/* ============ Timeline manager (admin) ============ */
function TimelineManager({ clients }) {
  const [clientName, setClientName] = useState(clients[0]?.name || '');
  const [adding, setAdding] = useState(false);
  const blank = () => ({ type: 'post', title: '', body: '', eventDate: new Date().toISOString().slice(0,10),
    platform: '', linkUrl: '', metricLeads: '', metricReach: '', metricClicks: '', metricSpend: '', visible: 1 });
  const [form, setForm] = useState(blank());
  const [nonce, setNonce] = useState(0);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return alert('חסרה כותרת');
    try {
      await api('timeline', { method: 'POST', body: { ...form, clientName } });
      setForm(blank()); setAdding(false); setNonce(n => n + 1);
    } catch (e) { alert(e.message); }
  };

  const isCampaign = form.type === 'campaign';

  return html`
    <div class="px-4 sm:px-5 pb-24 sm:pb-10">
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <select class=${`${inputCls} !w-56`} value=${clientName} onChange=${e => setClientName(e.target.value)}>
          ${clients.map(c => html`<option key=${c.id} value=${c.name}>${c.name}</option>`)}
        </select>
        <${Btn} onClick=${() => { setForm(blank()); setAdding(a => !a); }}>
          ${adding ? 'ביטול' : '+ הוספת פעילות'}
        <//>
      </div>

      ${adding && html`
        <div class="bg-white border border-zinc-200 rounded-2xl p-4 mb-5 space-y-3 max-w-2xl">
          <div class="flex gap-1.5 flex-wrap">
            ${Object.entries(TL_TYPES).filter(([k]) => k !== 'task' && k !== 'update').map(([k, t]) => html`
              <button key=${k} onClick=${() => set('type', k)}
                class=${`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm border transition ${
                  form.type === k ? 'bg-brand-lime border-brand-green text-brand-green font-bold'
                                  : 'border-zinc-200 text-zinc-600'}`}>
                <${t.icon} size=${14}/> ${t.label}
              </button>`)}
          </div>

          <div class="grid grid-cols-2 gap-3">
            <${Field} label="כותרת">
              <input class=${inputCls} value=${form.title} autoFocus
                     placeholder=${isCampaign ? 'קמפיין לידים - אוגוסט' : 'שם הפוסט'}
                     onChange=${e => set('title', e.target.value)} />
            <//>
            <${Field} label="תאריך">
              <input type="date" class=${inputCls} value=${form.eventDate}
                     onChange=${e => set('eventDate', e.target.value)} />
            <//>
          </div>

          <${Field} label="תיאור">
            <textarea class=${`${inputCls} min-h-[60px]`} value=${form.body}
                      onChange=${e => set('body', e.target.value)}></textarea>
          <//>

          <div class="grid grid-cols-2 gap-3">
            <${Field} label="פלטפורמה">
              <select class=${inputCls} value=${form.platform} onChange=${e => set('platform', e.target.value)}>
                <option value="">—</option>
                <option value="facebook">פייסבוק</option>
                <option value="instagram">אינסטגרם</option>
                <option value="google">גוגל</option>
                <option value="tiktok">טיקטוק</option>
              </select>
            <//>
            <${Field} label="קישור">
              <input class=${inputCls} dir="ltr" value=${form.linkUrl} placeholder="https://..."
                     onChange=${e => set('linkUrl', e.target.value)} />
            <//>
          </div>

          ${isCampaign && html`
            <div class="bg-zinc-50 rounded-xl p-3">
              <div class="text-xs font-bold text-zinc-500 mb-2 flex items-center gap-1.5">
                <${Target} size=${13}/> נתוני קמפיין
                <span class="mr-auto font-normal text-[10px] text-zinc-400">
                  ידני · יתמלא אוטומטית כשנחבר את Meta
                </span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <${Field} label="לידים">
                  <input type="number" class=${inputCls} value=${form.metricLeads}
                         onChange=${e => set('metricLeads', e.target.value)} />
                <//>
                <${Field} label="חשיפות">
                  <input type="number" class=${inputCls} value=${form.metricReach}
                         onChange=${e => set('metricReach', e.target.value)} />
                <//>
                <${Field} label="קליקים">
                  <input type="number" class=${inputCls} value=${form.metricClicks}
                         onChange=${e => set('metricClicks', e.target.value)} />
                <//>
                <${Field} label="עלות (₪)">
                  <input type="number" step="0.01" class=${inputCls} value=${form.metricSpend}
                         onChange=${e => set('metricSpend', e.target.value)} />
                <//>
              </div>
            </div>`}

          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" class="accent-brand-green w-4 h-4" checked=${!!form.visible}
                   onChange=${e => set('visible', e.target.checked ? 1 : 0)} />
            הצג ללקוח
          </label>

          <${Btn} className="w-full" onClick=${save}>הוספה לטיימליין<//>
        </div>`}

      <${Timeline} key=${clientName + nonce} clientName=${clientName} isClient=${false}
                   clients=${clients} onManage=${() => setAdding(true)} />
    </div>`;
}

/* ============ App ============ */
function App() {
  const [me, setMe] = useState(null);
  const [booting, setBooting] = useState(true);
  const [data, setData] = useState({ tasks: [], users: [], clients: [], counts: {} });
  const [view, setView] = useState('board');     // board | timeline | late | mine | team | clients | settings
  const [q, setQ] = useState('');
  const [fClient, setFClient] = useState('');
  const [fUser, setFUser] = useState('');
  const [open, setOpen] = useState(null);
  const [feed, setFeed] = useState({ updates: [], unread: 0 });
  const [err, setErr] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [moveTask, setMoveTask] = useState(null);
  const timer = useRef(null);
  const mobile = useIsMobile();

  const isAdmin = me?.role === 'admin';

  const load = useCallback(async () => {
    try {
      const [board, updates, fresh] = await Promise.all([api('board'), api('updates'), api('me')]);
      setData(board); setFeed(updates); setErr('');
      if (fresh && !fresh.guest) setMe(fresh);   // שם/צבע/טלפון מתעדכנים בלי התנתקות
    }
    catch (e) {
      if (e.message.includes('התחברות')) { setMe(null); return; }
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const u = await api('me');
        if (!u.guest) { setMe(u); if (u.role === 'client') setView('timeline'); await load(); }
      } catch {}
      setBooting(false);
    })();
  }, [load]);

  // Polling כל 10 שניות — רק כשהחלון בפוקוס
  useEffect(() => {
    if (!me) return;
    const tick = () => { if (!document.hidden) load(); };
    timer.current = setInterval(tick, 10000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(timer.current); window.removeEventListener('focus', tick); };
  }, [me, load]);

  const afterLogin = async (u) => {
    setMe(u);
    if (u.role === 'client') setView('timeline');   // הלקוח נוחת על הטיימליין שלו
    setBooting(true); await load(); setBooting(false);
  };

  const logout = async () => { await api('logout', { method: 'POST' }); setMe(null); };

  const move = async (id, status) => {
    setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, status } : t) }));
    try { await api('task_status', { method: 'POST', body: { id, status } }); }
    finally { load(); }
  };

  const exportCsv = () => {
    const head = ['כותרת', 'לקוח', 'אחראי', 'סטטוס', 'עדיפות', 'דדליין'];
    const rows = filtered.map(t => [
      t.title, t.clientName || '',
      data.users.find(u => u.username === t.assignedTo)?.name || '',
      COLS.find(c => c.key === t.status)?.label || '',
      PRIOS[t.priority].label, t.dueDate || '',
    ]);
    const csv = '\uFEFF' + [head, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `bidernet-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (booting) return html`
    <div class="app-loading"><div class="spinner"></div>
      <div style=${{ color: '#6b7280' }}>טוען את המערכת...</div></div>`;

  if (!me) return html`<${Login} onLogin=${afterLogin} />`;

  // לקוח נעול על הטיימליין בלבד — הגנה גם אם הגיע ל-view אחר
  const effView = (me.role === 'client') ? 'timeline' : view;

  const late = data.tasks.filter(isLate);
  const filtered = data.tasks.filter(t =>
    (!q || (t.title + ' ' + (t.description || '')).toLowerCase().includes(q.toLowerCase())) &&
    (!fClient || t.clientName === fClient) &&
    (!fUser || t.assignedTo === fUser) &&
    (view !== 'late' || isLate(t)) &&
    (view !== 'mine' || t.assignedTo === me.username)
  );

  const NavItem = ({ id, icon, label, badge }) => html`
    <button onClick=${() => setView(id)}
      class=${`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-1 transition text-sm ${
        view === id ? 'bg-brand-lime text-brand-green font-bold' : 'text-zinc-700 hover:bg-zinc-100'}`}>
      ${icon}<span>${label}</span>
      ${badge > 0 && html`
        <span class="mr-auto bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5">${badge}</span>`}
    </button>`;

  const TabItem = ({ id, icon, label, badge }) => html`
    <button onClick=${() => setView(id)}
      class=${`flex-1 flex flex-col items-center gap-0.5 py-2 relative ${
        view === id ? 'text-brand-green font-bold' : 'text-zinc-400'}`}>
      <span class="relative">
        ${icon}
        ${badge > 0 && html`
          <span class="absolute -top-1.5 -end-2 bg-red-500 text-white text-[9px] font-bold rounded-full px-1">
            ${badge}
          </span>`}
      </span>
      <span class="text-[10px]">${label}</span>
      ${view === id && html`<span class="absolute -top-px inset-x-4 h-0.5 bg-brand-lime rounded-full"></span>`}
    </button>`;

  const alertStrip = isAdmin && late.length > 0 && ['board','late','mine'].includes(view) && html`
    <div class="mx-4 mt-3 flex items-center gap-3 bg-brand-mint border border-brand-green/20 rounded-2xl px-3.5 py-3">
      <div class="w-9 h-9 rounded-full bg-brand-green grid place-items-center relative shrink-0">
        <${AlertTriangle} size=${16} color="#fff" />
        <span class="absolute -top-1 -end-1 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 border-2 border-brand-mint">
          ${late.length}
        </span>
      </div>
      <div class="min-w-0">
        <b class="block text-sm">
          ${late.length === 1 ? 'משימה אחת עברה את הדדליין' : `${late.length} משימות עברו את הדדליין`}
        </b>
        <small class="text-brand-green text-xs truncate block">
          ${[...new Set(late.map(t => t.clientName).filter(Boolean))].join(', ') || '—'}
        </small>
      </div>
      <${Btn} variant="green" className="mr-auto text-xs px-3 py-1.5 shrink-0"
              onClick=${() => setView('late')}>הצג<//>
    </div>`;

  const screen = effView === 'team'     ? html`<${TeamScreen} users=${data.users} onChange=${load} />`
               : effView === 'clients'  ? html`<${ClientsScreen} clients=${data.clients} onChange=${load} />`
               : effView === 'settings' ? html`<${SettingsScreen} />`
               : effView === 'timeline' ? (isAdmin
                    ? html`<${TimelineManager} clients=${data.clients} />`
                    : html`<${Timeline} clientName=${me.businessName} isClient=${true}
                                        clients=${data.clients} />`)
               : html`<${Board} tasks=${filtered} users=${data.users} clients=${data.clients}
                                counts=${data.counts} canEdit=${isAdmin} mobile=${mobile}
                                onOpen=${setOpen} onMove=${move} onQuickMove=${setMoveTask} />`;

  const bell = html`
    <${Bell_} feed=${feed} users=${data.users}
      onOpenTask=${id => { const t = data.tasks.find(x => x.id === id); if (t) setOpen(t); }}
      onSeen=${async () => { await api('updates', { method: 'POST' }); setFeed(f => ({ ...f, unread: 0 })); }} />`;

  const title = effView === 'team'     ? 'ניהול צוות ומשתמשים'
              : effView === 'settings' ? 'הגדרות'
              : effView === 'clients'  ? 'לקוחות'
              : effView === 'timeline' ? (isAdmin ? 'טיימליין לקוחות' : 'הפעילות שלי')
              : effView === 'late'     ? 'משימות באיחור'
              : effView === 'mine'     ? 'המשימות שלי'
              : 'לוח משימות';

  const drawers = html`
    ${open && html`
      <${Drawer} task=${open} users=${data.users} clients=${data.clients} me=${me} mobile=${mobile}
                 onClose=${() => setOpen(null)}
                 onSaved=${() => { setOpen(null); load(); }} />`}

    ${moveTask && html`
      <div class="fixed inset-0 z-50 flex items-end">
        <div class="absolute inset-0 bg-black/40" onClick=${() => setMoveTask(null)}></div>
        <div class="relative w-full bg-white rounded-t-3xl p-5 pb-8 space-y-2">
          <div class="w-10 h-1 bg-zinc-200 rounded-full mx-auto mb-3"></div>
          <b class="block text-sm mb-3 truncate">${moveTask.title}</b>
          ${COLS.map(c => html`
            <button key=${c.key}
              onClick=${() => { move(moveTask.id, c.key); setMoveTask(null); }}
              class=${`w-full flex items-center gap-2.5 rounded-xl px-4 py-3.5 text-start border transition ${
                moveTask.status === c.key ? 'bg-brand-lime border-brand-green text-brand-green font-bold'
                                          : 'bg-white border-zinc-200'}`}>
              <span class="w-2.5 h-2.5 rounded-full" style=${{ background: c.color }}></span>
              ${c.label}
              ${moveTask.status === c.key && html`<${Check} size=${16} class="mr-auto" />`}
            </button>`)}
        </div>
      </div>`}`;

  /* ================= מובייל ================= */
  if (mobile) return html`
    <div class="min-h-screen pb-16 bg-zinc-50">
      ${err && html`<div class="bg-red-50 text-red-700 text-xs text-center py-2">${err}</div>`}

      <header class="bg-white border-b border-zinc-200 sticky top-0 z-20">
        <div class="flex items-center gap-2 px-4 py-2.5">
          <img src="./logo.png" alt="bidernet" class="h-6 object-contain" />
          <div class="mr-auto flex items-center gap-1">
            ${bell}
            <${Avatar} user=${me} size=${30} />
          </div>
        </div>

        ${isAdmin && ['board','late','mine'].includes(effView) && html`
          <div class="flex items-center gap-2 px-4 pb-2.5">
            <div class="relative flex-1">
              <${Search} size=${15} class="absolute top-2.5 start-3 text-zinc-400" />
              <input class=${`${inputCls} ps-9 py-2 text-sm`} placeholder="חיפוש…"
                     value=${q} onChange=${e => setQ(e.target.value)} />
            </div>
            <button onClick=${() => setShowFilters(v => !v)} aria-label="סינון"
              class=${`p-2.5 rounded-xl border transition ${
                (fClient || fUser) ? 'bg-brand-lime border-brand-green text-brand-green'
                                   : 'border-zinc-200 text-zinc-500'}`}>
              <${SlidersHorizontal} size=${17} />
            </button>
            ${isAdmin && html`
              <button onClick=${() => setOpen({ id: 'new' })} aria-label="משימה חדשה"
                class="p-2.5 rounded-xl bg-brand-lime text-brand-green">
                <${Plus} size=${17} />
              </button>`}
          </div>

          ${showFilters && html`
            <div class="flex gap-2 px-4 pb-3">
              <select class=${`${inputCls} py-2 text-sm`} value=${fClient}
                      onChange=${e => setFClient(e.target.value)}>
                <option value="">כל הלקוחות</option>
                ${data.clients.map(c => html`<option key=${c.id} value=${c.name}>${c.name}</option>`)}
              </select>
              ${isAdmin && html`
                <select class=${`${inputCls} py-2 text-sm`} value=${fUser}
                        onChange=${e => setFUser(e.target.value)}>
                  <option value="">כל העובדים</option>
                  ${data.users.filter(u => u.role === 'admin').map(u =>
                    html`<option key=${u.id} value=${u.username}>${u.name}</option>`)}
                </select>`}
            </div>`}`}
      </header>

      ${alertStrip}

      <div class="px-4 pt-4 pb-3 flex items-center gap-2">
        <b class="text-base">${title}</b>
        ${isAdmin && ['board','late','mine'].includes(effView) && html`
          <span class="text-xs text-zinc-400">${filtered.length} משימות</span>`}
      </div>

      ${screen}

      <nav class="fixed bottom-0 inset-x-0 bg-white border-t border-zinc-200 flex z-30
                  pb-[env(safe-area-inset-bottom)]">
        ${!isAdmin && html`
          <${TabItem} id="timeline" icon=${html`<${Activity} size=${20} />`} label="הפעילות שלי" />
          <button onClick=${logout}
            class="flex-1 flex flex-col items-center gap-0.5 py-2 text-zinc-400">
            <${LogOut} size=${20} /><span class="text-[10px]">יציאה</span>
          </button>`}
        ${isAdmin && html`
          <${TabItem} id="board" icon=${html`<${LayoutGrid} size=${20} />`} label="לוח" />
          <${TabItem} id="late" icon=${html`<${Clock} size=${20} />`} label="באיחור" badge=${late.length} />
          <${TabItem} id="timeline" icon=${html`<${Activity} size=${20} />`} label="טיימליין" />
          <${TabItem} id="clients" icon=${html`<${Building2} size=${20} />`} label="לקוחות" />
          <${TabItem} id="team" icon=${html`<${Users} size=${20} />`} label="צוות" />`}
      </nav>

      ${drawers}
    </div>`;

  /* ================= דסקטופ ================= */
  return html`
    <div class="grid min-h-screen" style=${{ gridTemplateColumns: '220px minmax(0,1fr)' }}>

      <aside class="bg-white border-s border-zinc-200 p-4 flex flex-col gap-6 sticky top-0 h-screen">
        <img src="./logo.png" alt="bidernet" class="h-8 object-contain mx-auto mt-2" />

        <nav>
          <div class="text-[11px] text-zinc-400 px-3 pb-2">ניווט</div>
          <${NavItem} id="board" icon=${html`<${LayoutGrid} size=${17} />`} label="לוח משימות" />
          ${isAdmin && html`
            <${NavItem} id="late" icon=${html`<${Clock} size=${17} />`} label="באיחור" badge=${late.length} />
            <${NavItem} id="mine" icon=${html`<${User} size=${17} />`} label="המשימות שלי" />`}
        </nav>

        ${isAdmin && html`
          <nav>
            <div class="text-[11px] text-zinc-400 px-3 pb-2">ניהול</div>
            <${NavItem} id="timeline" icon=${html`<${Activity} size=${17} />`}  label="טיימליין" />
            <${NavItem} id="clients"  icon=${html`<${Building2} size=${17} />`} label="לקוחות" />
            <${NavItem} id="team"     icon=${html`<${Users} size=${17} />`}     label="צוות" />
            <${NavItem} id="settings" icon=${html`<${Settings} size=${17} />`}  label="הגדרות" />
            <button onClick=${load}
              class="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm text-zinc-700 hover:bg-zinc-100">
              <${RefreshCw} size=${17} /> רענון
            </button>
            <button onClick=${exportCsv}
              class="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm text-zinc-700 hover:bg-zinc-100">
              <${Download} size=${17} /> ייצוא
            </button>
          </nav>`}

        <div class="mt-auto">
          <button onClick=${logout}
            class="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm text-zinc-500 hover:bg-zinc-100">
            <${LogOut} size=${17} /> יציאה
          </button>
          <div class="text-center text-[10px] text-zinc-300 pt-2">v${APP_VERSION}</div>
        </div>
      </aside>

      <main class="min-w-0 flex flex-col">
        ${err && html`<div class="bg-red-50 border-b border-red-200 text-red-700 text-xs text-center py-2">${err}</div>`}

        <header class="bg-white border-b border-zinc-200 px-5 py-3 flex items-center gap-2.5 sticky top-0 z-20">
          ${isAdmin && html`
            <${Btn} onClick=${() => setOpen({ id: 'new' })}>
              <${Plus} size=${16} class="inline -mt-0.5 ml-1" /> משימה חדשה
            <//>`}

          ${isAdmin && ['board','late','mine'].includes(effView) && html`
            <div class="relative">
              <${Search} size=${15} class="absolute top-2.5 start-3 text-zinc-400" />
              <input class=${`${inputCls} ps-9 !w-56`} placeholder="חיפוש משימה…"
                     value=${q} onChange=${e => setQ(e.target.value)} />
            </div>
            <select class=${`${inputCls} !w-44`} value=${fClient} onChange=${e => setFClient(e.target.value)}>
              <option value="">כל הלקוחות</option>
              ${data.clients.map(c => html`<option key=${c.id} value=${c.name}>${c.name}</option>`)}
            </select>
            ${isAdmin && html`
              <select class=${`${inputCls} !w-44`} value=${fUser} onChange=${e => setFUser(e.target.value)}>
                <option value="">כל העובדים</option>
                ${data.users.filter(u => u.role === 'admin').map(u =>
                  html`<option key=${u.id} value=${u.username}>${u.name}</option>`)}
              </select>`}`}

          <div class="mr-auto flex items-center gap-2">
            ${bell}
            <span class="text-sm text-zinc-500 ms-1">${greeting()}, <b class="text-zinc-900">${me.name}</b></span>
            <${Avatar} user=${me} size=${32} />
          </div>
        </header>

        ${alertStrip}

        <div class="flex items-center gap-2 px-5 pt-5 pb-3 font-bold text-lg">
          ${title}
          ${isAdmin && ['board','late','mine'].includes(effView) && html`
            <span class="text-xs font-normal text-zinc-400">${filtered.length} משימות</span>`}
        </div>

        ${screen}
      </main>

      ${drawers}
    </div>`;
}

/* ============ Error boundary ============ */
class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('[bidernet] crash:', err, info); }
  render() {
    if (!this.state.err) return this.props.children;
    return html`
      <div class="min-h-screen grid place-items-center p-6 bg-white">
        <div class="max-w-md text-center space-y-3">
          <div class="text-4xl">⚠️</div>
          <b class="block text-lg">משהו נשבר במסך הזה</b>
          <p class="text-sm text-zinc-500 leading-relaxed">
            שאר המערכת תקינה. אם זה חוזר, שלח את השורה הבאה למפתח:
          </p>
          <code class="block text-xs bg-zinc-100 rounded-xl p-3 text-start" dir="ltr">
            v${APP_VERSION} · ${String(this.state.err?.message || this.state.err)}
          </code>
          <div class="flex gap-2 justify-center pt-1">
            <button onClick=${() => location.reload()}
              class="bg-brand-lime text-brand-green font-bold rounded-xl px-4 py-2">רענון</button>
            <button onClick=${() => this.setState({ err: null })}
              class="bg-zinc-100 rounded-xl px-4 py-2">חזרה</button>
          </div>
        </div>
      </div>`;
  }
}

createRoot(document.getElementById('root')).render(html`<${Boundary}><${App} /><//>`);
