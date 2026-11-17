import { useEffect, useState } from 'react';
import { Section } from '../components/ui';
import { api, importEnabled } from '../lib/api';
import { currentYm, dateTimeLabel, dayLabel, daysLabel, money, moneyExact } from '../lib/format';
import { priceView } from '../lib/pricing';
import type { AppInfo, AuditEntry, LegacyExport, Role } from '../lib/types';
import { MishkatCredit } from '../components/Brand';
import { BACKGROUNDS, FONT_FAMILIES, FONT_SIZES, getPref, PALETTES, setPref, type PrefKey } from '../lib/prefs';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';
import { AVATARS, budgetOf, nameOf, useStore, type Store } from '../store';
import Backup from './Backup';
import Feedback from './Feedback';
import { PinForm, signOutWithWarning } from './Onboarding';

const ROLES: { id: Role; label: string }[] = [
  { id: 'admin', label: 'مدير (كل الصلاحيات)' },
  { id: 'member', label: 'عضو (يسجّل مصروفات)' },
  { id: 'viewer', label: 'مشاهد فقط' },
  { id: 'pending', label: 'موقوف / بانتظار الموافقة' },
];
const roleLabel = (r: Role) => ROLES.find((x) => x.id === r)?.label ?? r;
const toBudget = (v: string) => (v.trim() === '' || Number(v) <= 0 ? null : Number(v));

function Invite() {
  const { household } = useStore();
  const [copied, setCopied] = useState(false);
  if (!household) return null;
  const link = window.location.origin + window.location.pathname;
  const text = `انضم إلى ميزانية «${household.name}»:\n${link}\nسجّل الدخول ثم اختر «الانضمام إلى أسرة» وأدخل الرمز: ${household.invite_code}`;

  async function share() {
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); }
    } catch { /* ألغى المستخدم المشاركة */ }
  }
  return (
    <Section title="دعوة أفراد الأسرة">
      <p className="muted small">أرسل هذا الرمز لأفراد أسرتك فقط. من يدخله يظهر في قائمة الأعضاء «بانتظار الموافقة» ولا يرى شيئاً حتى تمنحه صلاحية.</p>
      <div className="inline">
        <code className="invite" dir="ltr">{household.invite_code}</code>
        <button className="btn primary" onClick={share}>{copied ? 'تم النسخ ✓' : 'مشاركة الدعوة'}</button>
      </div>
    </Section>
  );
}

function Members() {
  const { profiles, me, run, budgets } = useStore();
  const ym = currentYm();
  return (
    <Section title="الأعضاء والصلاحيات">
      <p className="muted small">منح المصروف وترحيله يتمان من «الرئيسية ← دخلي ومنح المصروف (خاص بي)».</p>
      <ul className="rows">
        {profiles.map((p) => (
          <li key={p.id} className="stack">
            <div>
              <b>{p.avatar ? p.avatar + ' ' : ''}{p.full_name}</b> {p.id === me.id && <span className="chip">أنت</span>} {p.role === 'pending' && <span className="chip warn">بانتظار الموافقة</span>}
              {p.email ? <div className="muted small" dir="ltr">{p.email}</div> : <div className="muted small">انضم بالرمز (بلا حساب جوجل)</div>}
            </div>
            <div className="inline">
              <select value={p.role} disabled={p.id === me.id} aria-label="الصلاحية" onChange={(e) => run(() => api.updateProfile(p.id, { role: e.target.value as Role }))}>
                {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            {p.role !== 'pending' && budgetOf(budgets, ym, p.id) > 0 && (
              <div className="small">مصروفه هذا الشهر: <b className="num grant-total">{money(budgetOf(budgets, ym, p.id))}</b></div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function NamedList({ title, kind, hint }: { title: string; kind: 'categories' | 'beneficiaries'; hint: string }) {
  const store = useStore();
  const { run } = store;
  const items = store[kind] as { id: number; name: string; active: boolean; monthly_budget?: number | null }[];
  const save = kind === 'categories' ? api.saveCategory : api.saveBeneficiary;
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() && (await run(() => save({ name: name.trim() })))) setName('');
  }
  return (
    <Section title={`${title} (${items.length})`} action={<button className="link" onClick={() => setOpen(!open)}>{open ? 'إخفاء' : 'عرض وتعديل'}</button>}>
      <form className="inline" onSubmit={add}>
        <input className="grow" placeholder={`اسم جديد…`} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn primary">إضافة</button>
      </form>
      {open && (
        <>
          <p className="muted small">{hint}</p>
          <ul className="rows">
            {items.map((c) => (
              <li key={c.id} className="stack">
                <input
                  defaultValue={c.name} key={c.name} aria-label="الاسم" className={c.active ? '' : 'off'}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) run(() => save({ id: c.id, name: v })); }}
                />
                <div className="inline">
                  {kind === 'categories' && (
                    <input
                      type="number" inputMode="decimal" min="0" placeholder="ميزانية شهرية" aria-label="ميزانية البند" defaultValue={c.monthly_budget ?? ''} key={`b-${c.monthly_budget}`}
                      onBlur={(e) => { const v = toBudget(e.target.value); if (v !== (c.monthly_budget ?? null)) run(() => api.saveCategory({ id: c.id, name: c.name, monthly_budget: v })); }}
                    />
                  )}
                  <label className="check">
                    <input type="checkbox" checked={c.active} onChange={(e) => run(() => save({ id: c.id, name: c.name, active: e.target.checked }))} /> مفعّل
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

const ACTIONS: Record<string, string> = { insert: 'إضافة', update: 'تعديل', delete: 'حذف', import: 'استيراد' };
const TABLES: Record<string, string> = { allowances: 'مصروف ممنوح', allowance_grants: 'دفعة مصروف', expenses: 'مصروف', incomes: 'دخل', categories: 'بند', beneficiaries: 'مستفيد', profiles: 'عضو', legacy: 'بيانات أكسيس' };
const FIELDS: Record<string, string> = {
  amount: 'المبلغ', paid_on: 'التاريخ', received_on: 'التاريخ', notes: 'ملاحظات', source: 'المصدر', category_id: 'البند',
  beneficiary_id: 'المستفيد', name: 'الاسم', active: 'مفعّل', monthly_budget: 'الميزانية', role: 'الصلاحية', receipt_path: 'الفاتورة',
  incomes: 'دخل', expenses: 'مصروفات',
};

function describe(a: AuditEntry, s: Store): string {
  const show = (k: string, v: unknown): string => {
    if (v == null || v === '') return '—';
    if (k === 'category_id') return nameOf(s.categories, v as number) || String(v);
    if (k === 'beneficiary_id') return nameOf(s.beneficiaries, v as number) || String(v);
    if (k === 'role') return roleLabel(v as Role);
    if (k === 'receipt_path') return 'صورة';
    if (typeof v === 'number') return moneyExact(v);
    if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
    return String(v);
  };
  const row = a.new_data ?? a.old_data ?? {};
  if (a.action === 'update' && a.old_data && a.new_data) {
    const who = a.table_name === 'profiles' ? `${a.new_data.full_name}: ` : '';
    return who + Object.keys(FIELDS).filter((k) => k in a.new_data! && JSON.stringify(a.old_data![k]) !== JSON.stringify(a.new_data![k]))
      .map((k) => `${FIELDS[k]}: ${show(k, a.old_data![k])} ← ${show(k, a.new_data![k])}`).join('، ');
  }
  return Object.keys(FIELDS).filter((k) => row[k] != null && row[k] !== '' && k !== 'active').map((k) => `${FIELDS[k]}: ${show(k, row[k])}`).join('، ');
}

function AuditLog() {
  const store = useStore();
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [more, setMore] = useState(true);
  const [open, setOpen] = useState(false);
  const PAGE = 50;

  async function load(offset: number) {
    const r = await api.listAudit(PAGE, offset);
    setRows((old) => (offset ? [...old, ...r] : r));
    setMore(r.length === PAGE);
  }
  useEffect(() => { if (open) load(0).catch(() => setMore(false)); }, [open, store.version]);

  return (
    <Section title="سجل العمليات" action={<button className="link" onClick={() => setOpen(!open)}>{open ? 'إخفاء' : 'عرض'}</button>}>
      <p className="muted small">كل إضافة أو تعديل أو حذف يُسجَّل تلقائياً بالتاريخ والوقت واسم المستخدم، ولا يمكن تعديل السجل.</p>
      {open && (
        <>
          {!rows.length && <p className="muted">لا توجد عمليات مسجلة بعد.</p>}
          <ul className="rows">
            {rows.map((a) => (
              <li key={a.id} className="stack">
                <div>
                  <span className={`chip ${a.action === 'delete' ? 'warn' : ''}`}>{ACTIONS[a.action] ?? a.action} {TABLES[a.table_name] ?? a.table_name}</span>{' '}
                  <b>{a.user_name ?? '—'}</b> <span className="muted small num" dir="ltr">{dateTimeLabel(a.at)}</span>
                </div>
                <div className="small">{describe(a, store)}</div>
              </li>
            ))}
          </ul>
          {more && rows.length > 0 && <button className="btn block" onClick={() => load(rows.length)}>عرض المزيد</button>}
        </>
      )}
    </Section>
  );
}

function ImportLegacy() {
  const { run } = useStore();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    await run(async () => {
      const data = JSON.parse(await file.text()) as LegacyExport;
      if (!Array.isArray(data.expenses) || !Array.isArray(data.incomes)) throw new Error('الملف ليس بصيغة التصدير المتوقعة (seed.json).');
      setStatus(`جارٍ استيراد ${data.expenses.length} مصروف…`);
      const r = await api.importLegacy(data, (done, total) => setStatus(`جارٍ الاستيراد… ${done} / ${total}`));
      setStatus(`تم: أُضيف ${r.incomes} دخل و ${r.expenses} مصروف (السجلات الموجودة من قبل لا تتكرر).`);
    });
    setBusy(false);
  }

  return (
    <Section title="استيراد بيانات أكسيس">
      {api.mode === 'local' ? (
        <p className="muted small">في الوضع التجريبي تُحمَّل بيانات أكسيس تلقائياً من الملف public/local/seed.json. بعد ربط Supabase استخدم هذا الزر لرفع نفس الملف إلى القاعدة السحابية.</p>
      ) : (
        <>
          <p className="muted small">شغّل scripts/export-access.ps1 على جهازك ثم اختر الملف الناتج public/local/seed.json. يمكن تكرار العملية بأمان.</p>
          <label className="btn">
            اختيار ملف seed.json
            <input type="file" accept="application/json,.json" hidden disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </>
      )}
      {status && <p role="status">{status}</p>}
    </Section>
  );
}

function DangerZone() {
  const { me, household, isAdmin, profiles } = useStore();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (api.mode !== 'cloud' || !household) return null;
  const others = profiles.filter((p) => p.id !== me.id && p.role !== 'pending').length;

  async function go(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await fn(); window.location.reload(); } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  function deleteAccount() {
    const extra = isAdmin && others === 0 ? ' أنت الوحيد في الأسرة، فستُحذف الأسرة وكل بياناتها معه.' : '';
    if (confirm(`حذف حسابك نهائياً؟${extra} لا يمكن التراجع.`)) go(() => api.deleteAccount());
  }

  return (
    <Section title="حذف البيانات" action={<button className="link" onClick={() => setOpen(!open)}>{open ? 'إخفاء' : 'عرض'}</button>}>
      {open && (
        <div className="form">
          {error && <p className="error" role="alert">{error}</p>}
          {isAdmin && (
            <>
              <p className="small">
                <b>حذف الأسرة:</b> يحذف نهائياً كل الدخل والمصروفات والبنود وصور الفواتير وسجل العمليات لـ«{household.name}»، ويُخرج كل أعضائها. لا يمكن التراجع.
              </p>
              <label className="small">للتأكيد اكتب اسم الأسرة: <b>{household.name}</b>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
              </label>
              <button className="btn danger" disabled={busy || typed.trim() !== household.name} onClick={() => go(() => api.deleteHousehold())}>
                حذف الأسرة وكل بياناتها نهائياً
              </button>
            </>
          )}
          <p className="small">
            <b>حذف حسابي:</b> يحذف اسمك وبريدك من التطبيق نهائياً. ما سجّلته من مصروفات يبقى لأسرتك بلا اسم.
            {isAdmin && others > 0 && ' أنت مدير: عيّن مديراً آخر أولاً أو احذف الأسرة.'}
          </p>
          <button className="btn danger" disabled={busy} onClick={deleteAccount}>حذف حسابي نهائياً</button>
        </div>
      )}
    </Section>
  );
}

/** مجموعة أزرار لاختيار واحد من بدائل */
function Choice<T extends string>({ label, options, value, onPick }: { label: string; options: readonly (readonly [T, string])[]; value: T; onPick: (v: T) => void }) {
  return (
    <>
      <h3>{label}</h3>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(([id, text]) => (
          <button key={id} type="button" role="radio" aria-checked={value === id} className={value === id ? 'on' : ''} onClick={() => onPick(id)}>{text}</button>
        ))}
      </div>
    </>
  );
}

/** شكل التطبيق على هذا الجهاز: كل مستخدم يختار ما يناسبه */
function Appearance() {
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const [prefs, setPrefs] = useState(() => ({ fs: getPref('fs'), font: getPref('font'), bg: getPref('bg'), palette: getPref('palette') }));
  const pick = (key: PrefKey) => (value: string) => { setPref(key, value); setPrefs((p) => ({ ...p, [key]: value })); };
  return (
    <Section title="المظهر">
      <p className="muted small">هذه الاختيارات تخص هذا الجهاز فقط، ولا تغيّر ما يراه باقي أفراد الأسرة.</p>
      <Choice label="الوضع" options={[['auto', 'تلقائي (حسب الوقت)'], ['light', '☀️ نهاري'], ['dark', '🌙 ليلي']] as const} value={theme} onPick={(v) => { setThemePref(v); setTheme(v); }} />
      <Choice label="حجم الخط" options={FONT_SIZES} value={prefs.fs} onPick={pick('fs')} />
      <Choice label="نوع الخط" options={FONT_FAMILIES} value={prefs.font} onPick={pick('font')} />
      <Choice label="الألوان" options={PALETTES} value={prefs.palette} onPick={pick('palette')} />
      <Choice label="الخلفية" options={BACKGROUNDS} value={prefs.bg} onPick={pick('bg')} />
    </Section>
  );
}

/** الشهر المجاني والتفعيل برمز بعد الدفع مرة واحدة */
function Subscription() {
  const { license, household, isAdmin, run } = useStore();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!license.licensed) api.getAppInfo().then(setInfo).catch(() => {}); }, [license.licensed]);
  if (!household?.trial_ends_at) return null; // مخطط قديم بلا بيانات اشتراك
  const pv = priceView(info);

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (await run(() => api.redeemLicense(code))) setCode('');
    setBusy(false);
  }

  if (license.licensed) {
    return (
      <Section title="الاشتراك">
        <p>✅ أسرتك مفعّلة{household.licensed_at ? ` منذ ${household.licensed_at.slice(0, 10)}` : ''}. التفعيل دائم ولا يحتاج تجديداً.</p>
      </Section>
    );
  }
  return (
    <Section title="الاشتراك">
      {license.expired
        ? <p className="error">انتهى الشهر المجاني يوم {household.trial_ends_at.slice(0, 10)}. بياناتكم محفوظة وتظهر للعرض، والتسجيل والتعديل متوقفان حتى التفعيل.</p>
        : <p>أنتم في الشهر المجاني: باقي <b className="grant-total">{daysLabel(license.daysLeft)}</b> (حتى {household.trial_ends_at.slice(0, 10)}).</p>}
      <p className="small">بعد الشهر المجاني يُفعَّل التطبيق للأسرة كلها بدفعة واحدة، بلا اشتراك شهري.{!pv && info?.price ? <> السعر: <b>{info.price}</b>.</> : null}</p>
      {pv && (
        <div className={`price ${pv.active ? 'on-sale' : ''}`}>
          <span className="muted small">السعر</span>
          {pv.active && <s className="num">{money(pv.base)}</s>}
          <strong className="num">{money(pv.final)}</strong> <span>{pv.currency}</span>
          <span className="muted small">تُدفع مرة واحدة</span>
          {pv.active && <span className="sale-badge">خصم {pv.percent}% حتى {dayLabel(pv.to!)}</span>}
          {pv.upcoming && <span className="sale-badge soon">خصم {pv.percent}% من {dayLabel(pv.from!)} إلى {dayLabel(pv.to!)}</span>}
        </div>
      )}
      {info?.payment_info && <p className="small pre">{info.payment_info}</p>}
      <p className="small">للحصول على رمز التفعيل راسل مشكاة: <a href="mailto:mishkatapps@gmail.com">mishkatapps@gmail.com</a></p>
      {isAdmin ? (
        <form className="inline wrap" onSubmit={activate}>
          <input dir="ltr" placeholder="رمز التفعيل MSK-…" required autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn primary" disabled={busy}>تفعيل</button>
        </form>
      ) : <p className="muted small">التفعيل يقوم به مدير الأسرة.</p>}
    </Section>
  );
}

export default function Admin() {
  const { me, isAdmin, reload, budgets, run, pinSet, household } = useStore();
  const myBudget = budgetOf(budgets, currentYm(), me.id);
  // عند فتح الإدارة نجلب أحدث البيانات حتى تظهر طلبات الانضمام الجديدة دون إعادة تحميل الصفحة
  useEffect(() => { reload().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Section title="حسابي">
        <p><b>{me.full_name}</b> · {roleLabel(me.role)}</p>
        {me.anonymous
          ? (
            <>
              <p className="muted small">منضم بالرمز بلا حساب جوجل: دخولك محفوظ في هذا المتصفح. إن خرجت أو غيّرت الهاتف تعود من «الانضمام برمز دعوة» ← «سبق أن انضممت» برمز الدعوة ورمزك الشخصي.</p>
              {household && (
                <p className="small">رمز أسرتك: <code className="invite inline-code" dir="ltr">{household.invite_code}</code> احفظه مع رمزك الشخصي؛ تحتاجهما معاً للدخول من جهاز آخر.</p>
              )}
              <h3>{pinSet ? 'تغيير رمزي الشخصي' : 'رمزي الشخصي (لم يُضبط بعد)'}</h3>
              <PinForm onDone={() => reload().catch(() => {})} submitLabel={pinSet ? 'تغيير الرمز الشخصي' : 'حفظ الرمز الشخصي'} />
            </>
          )
          : <p className="muted small" dir="ltr">{me.email}</p>}
        {myBudget > 0 && <p className="small">مصروفك هذا الشهر: <b className="num grant-total">{money(myBudget)}</b></p>}

        <h3>رمزي</h3>
        <p className="muted small">اختر رمزاً يظهر بجانب المصروفات التي تسجّلها أنت.</p>
        <div className="avatars" role="radiogroup" aria-label="رمزي">
          {AVATARS.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={me.avatar === a} className={me.avatar === a ? 'on' : ''} onClick={() => run(() => api.setMyAvatar(me.avatar === a ? '' : a))}>{a}</button>
          ))}
        </div>


        <div className="inline">
          {api.mode === 'cloud' && <button className="btn" onClick={() => signOutWithWarning(me)}>تسجيل الخروج</button>}
          <a className="small" href="./privacy.html">سياسة الخصوصية</a>
        </div>
      </Section>
      <Appearance />
      <Subscription />
      <Feedback />
      {isAdmin && (
        <>
          <Invite />
          <Members />
          <NamedList title="بنود المصروفات" kind="categories" hint="البند غير المفعّل يختفي من قائمة التسجيل ويبقى في الإحصاءات. الميزانية الشهرية للبند اختيارية." />
          <NamedList title="المستفيدون" kind="beneficiaries" hint="من صُرف المبلغ لأجله (الأسرة أو أحد أفرادها)." />
          <AuditLog />
          <Backup />
          {importEnabled && <ImportLegacy />}
        </>
      )}
      <DangerZone />
      <p className="center-line"><MishkatCredit /></p>
    </>
  );
}
