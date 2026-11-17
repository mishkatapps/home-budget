import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { LANG, T } from '../lib/i18n';
import type { Household, Profile, ReentryMember } from '../lib/types';

const PIN_RE = /^\d{4,8}$/;

/** من انضم بالرمز بلا حساب: دخوله في هذا المتصفح فقط؛ يعود بعد الخروج برمزه الشخصي */
export function signOutWithWarning(me: Profile) {
  if (me.anonymous && !confirm('أنت منضم بالرمز بلا حساب جوجل. بعد الخروج تعود من «سبق أن انضممت» برمز دعوة الأسرة ورمزك الشخصي. إن لم تكن ضبطت رمزاً شخصياً فستحتاج طلب انضمام جديد. هل تخرج؟')) return;
  api.signOut();
}

/** رمز الأسرة واسم العضو يُحفظان على الجهاز: بعد الخروج يعود العضو برمزه الشخصي فقط */
const INVITE_KEY = 'memberReturn';
export function rememberMember(code: string, name: string | null) {
  try { localStorage.setItem(INVITE_KEY, JSON.stringify({ code: code.trim().toUpperCase(), name: name ?? '' })); } catch { /* تخزين محجوب */ }
}
function savedMember(): { code: string; name: string } | null {
  try { const v = JSON.parse(localStorage.getItem(INVITE_KEY) ?? 'null'); return v?.code ? v : null; } catch { return null; }
}

/** نطلب من المتصفح ألا يمسح بيانات التطبيق تلقائياً (يقلل ضياع دخول العضو) */
function keepStorage() {
  try { navigator.storage?.persist?.(); } catch { /* غير مدعوم */ }
}

/** يضبط العضو رمزه الشخصي (أو يغيّره) */
export function PinForm({ onDone, submitLabel = 'حفظ الرمز الشخصي' }: { onDone?: () => void; submitLabel?: string }) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!PIN_RE.test(pin)) return setMsg('⚠ الرمز الشخصي من 4 إلى 8 أرقام.');
    if (pin !== pin2) return setMsg('⚠ الرمزان غير متطابقين.');
    setBusy(true);
    try { await api.setMyPin(pin); setPin(''); setPin2(''); setMsg('تم حفظ رمزك الشخصي. احفظه جيداً.'); onDone?.(); }
    catch (err) { setMsg('⚠ ' + (err as Error).message); }
    setBusy(false);
  }
  return (
    <form className="form block" onSubmit={save}>
      {msg && <p className={msg.startsWith('⚠') ? 'error' : ''} role="status">{msg}</p>}
      <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} required placeholder="رمز شخصي (4 إلى 8 أرقام)" value={pin} onChange={(e) => setPin(e.target.value)} />
      <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} required placeholder="أعد كتابة الرمز" value={pin2} onChange={(e) => setPin2(e.target.value)} />
      <button className="btn primary" disabled={busy}>{submitLabel}</button>
    </form>
  );
}

/** عضو سبق انضمامه بلا حساب وضاع دخوله: رمز دعوة الأسرة ← يختار اسمه ← رمزه الشخصي */
function Reentry({ onDone }: { onDone: () => void }) {
  const saved = savedMember();
  const [code, setCode] = useState(saved?.code ?? '');
  const [members, setMembers] = useState<ReentryMember[] | null>(null);
  const [memberId, setMemberId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function find(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const list = await api.membersForReentry(code);
      if (!list.length) setError('لا يوجد أعضاء لهم رمز شخصي في أسرة بهذا الرمز. تأكد من رمز الدعوة، أو اطلب انضماماً جديداً.');
      else {
        setMembers(list);
        const mine = list.find((m) => saved?.name && m.full_name === saved.name);
        setMemberId(mine?.id ?? (list.length === 1 ? list[0].id : ''));
      }
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }
  // على الجهاز نفسه: رمز الأسرة محفوظ، فنعرض الأسماء مباشرة ويبقى الرمز الشخصي فقط
  useEffect(() => { if (saved?.code) find(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (await api.reenter(code, memberId, pin)) {
        rememberMember(code, members?.find((m) => m.id === memberId)?.full_name ?? null);
        keepStorage(); onDone(); return;
      }
      setPin('');
      setError('الرمز الشخصي غير صحيح. بعد 5 محاولات خاطئة يُوقف الدخول 15 دقيقة.');
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  if (!members) {
    return (
      <form className="form block" onSubmit={find}>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="muted small">اكتب رمز أسرتك (رمز الدعوة). تجده عند مدير الأسرة، أو في «حسابي» على جهازك القديم. يُطلب مرة واحدة على كل جهاز جديد؛ بعدها يكفي رمزك الشخصي.</p>
        <input placeholder="رمز الدعوة" required dir="ltr" autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn primary" disabled={busy}>متابعة</button>
      </form>
    );
  }
  return (
    <form className="form block" onSubmit={enter}>
      {error && <p className="error" role="alert">{error}</p>}
      <label>من أنت؟
        <select required value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">— اختر اسمك —</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.avatar ? m.avatar + ' ' : ''}{m.full_name}</option>)}
        </select>
      </label>
      <label>رمزك الشخصي
        <input type="password" inputMode="numeric" autoComplete="off" maxLength={8} required value={pin} onChange={(e) => setPin(e.target.value)} />
      </label>
      <button className="btn primary" disabled={busy || !memberId}>دخول</button>
      <button type="button" className="link small" onClick={() => { setMembers(null); setPin(''); setError(null); }}>تغيير رمز الدعوة</button>
    </form>
  );
}

/**
 * حساب بلا أسرة:
 * - من دخل بجوجل ينشئ أسرته (فيصير مديرها) أو ينضم برمز دعوة.
 * - من دخل بلا حساب: عضو جديد ينضم برمز الدعوة ويختار رمزاً شخصياً، أو عضو سابق يعود برمزه الشخصي.
 */
export function Onboarding({ me, onDone }: { me: Profile; onDone: () => void }) {
  const [name, setName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [returning, setReturning] = useState(() => !!savedMember());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await fn(); keepStorage(); onDone(); } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  function joinAnonymous(e: React.FormEvent) {
    e.preventDefault();
    if (!PIN_RE.test(pin)) return setError('الرمز الشخصي من 4 إلى 8 أرقام.');
    if (pin !== pin2) return setError('الرمزان الشخصيان غير متطابقين.');
    go(async () => { await api.joinHousehold(code, memberName); await api.setMyPin(pin); rememberMember(code, memberName); });
  }

  if (me.anonymous) {
    return (
      <div className="center">
        <div className="login card">
          <img src="./icon.svg" alt="" width={56} height={56} />
          <h1>أفراد الأسرة</h1>
          <div className="segmented block" role="tablist">
            <button type="button" className={!returning ? 'on' : ''} onClick={() => { setReturning(false); setError(null); }}>عضو جديد</button>
            <button type="button" className={returning ? 'on' : ''} onClick={() => { setReturning(true); setError(null); }}>سبق أن انضممت</button>
          </div>
          {returning ? <Reentry onDone={onDone} /> : (
            <form className="form block" onSubmit={joinAnonymous}>
              {error && <p className="error" role="alert">{error}</p>}
              <p className="muted small">أدخل رمز الدعوة من مدير أسرتك، واختر رمزاً شخصياً تعود به إن خرجت أو غيّرت هاتفك.</p>
              <input placeholder="اسمك كما يعرفك أهلك" required maxLength={60} autoComplete="name" value={memberName} onChange={(e) => setMemberName(e.target.value)} />
              <input placeholder="رمز الدعوة" required dir="ltr" autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
              <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} required placeholder="رمز شخصي من اختيارك (4 إلى 8 أرقام)" value={pin} onChange={(e) => setPin(e.target.value)} />
              <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} required placeholder="أعد كتابة الرمز الشخصي" value={pin2} onChange={(e) => setPin2(e.target.value)} />
              <button className="btn primary" disabled={busy}>طلب الانضمام</button>
            </form>
          )}
          <button className="link small" onClick={() => api.signOut()}>رجوع</button>
        </div>
      </div>
    );
  }

  return (
    <div className="center">
      <div className="login card">
        <img src="./icon.svg" alt="" width={56} height={56} />
        <h1>مرحباً {me.full_name ?? ''}</h1>
        {error && <p className="error" role="alert">{error}</p>}

        <form className="form block" onSubmit={(e) => { e.preventDefault(); go(() => api.createHousehold(name, LANG)); }}>
          <h2>أسرة جديدة</h2>
          <p className="muted small">تبدأ ميزانية أسرتك وتصبح مديرها، ثم تدعو أفرادها برمز دعوة.</p>
          <input placeholder="اسم الأسرة، مثال: أسرة أحمد" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" disabled={busy}>إنشاء الأسرة</button>
        </form>
        <div className="divider muted small">أو</div>
        <form className="form block" onSubmit={(e) => { e.preventDefault(); go(() => api.joinHousehold(code)); }}>
          <h2>الانضمام إلى أسرة</h2>
          <p className="muted small">أدخل رمز الدعوة الذي أرسله لك مدير أسرتك. ستدخل بعد موافقته.</p>
          <input placeholder="رمز الدعوة" required dir="ltr" autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn" disabled={busy}>طلب الانضمام</button>
        </form>

        <button className="link small" onClick={() => api.signOut()}>تسجيل الخروج ({me.email})</button>
      </div>
    </div>
  );
}

/** انضم برمز دعوة وينتظر موافقة المدير (أو أوقفه المدير) */
export function Pending({ me, onRefresh }: { me: Profile; onRefresh: () => void }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [pinSet, setPinSet] = useState(true);
  useEffect(() => {
    api.getHousehold().then(setHousehold).catch(() => {});
    if (me.anonymous) api.hasMyPin().then(setPinSet).catch(() => {});
  }, [me.anonymous]);

  async function cancel() {
    if (!confirm('سحب طلب الانضمام؟')) return;
    await api.leaveHousehold().catch(() => {});
    onRefresh();
  }

  return (
    <div className="center">
      <div className="login card">
        <h1>في انتظار الموافقة</h1>
        <p>
          {T(
            `مرحباً ${me.full_name ?? ''}. وصل طلبك${household ? ` إلى «${household.name}»` : ''}، وسيظهر لمدير الأسرة في شاشة الإدارة ليمنحك الصلاحية.`,
            `Welcome ${me.full_name ?? ''}. Your request reached ${household ? `"${household.name}"` : 'the family'}, and will appear to the family admin on the Admin screen to grant you access.`,
          )}
        </p>
        {me.anonymous && pinSet && <p className="muted small">إن أغلقت التطبيق أو فتحته من متصفح آخر، ارجع من «الانضمام برمز دعوة» ثم «سبق أن انضممت» برمزك الشخصي.</p>}
        {me.anonymous && !pinSet && (
          <>
            <p className="error">اضبط رمزاً شخصياً الآن حتى تستطيع العودة إن خرجت من هذا المتصفح.</p>
            <PinForm onDone={() => setPinSet(true)} />
          </>
        )}
        <button className="btn primary block" onClick={onRefresh}>تحديث</button>
        {me.household_id !== 'legacy' && <button className="btn block" onClick={cancel}>سحب الطلب</button>}
        {!me.anonymous && <button className="link small" onClick={() => api.signOut()}>تسجيل الخروج ({me.email})</button>}
      </div>
    </div>
  );
}
