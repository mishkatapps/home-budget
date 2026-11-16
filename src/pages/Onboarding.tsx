import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Household, Profile } from '../lib/types';

/** من انضم بالرمز بلا حساب: هويته في هذا المتصفح فقط، فالخروج يعني طلب انضمام جديد */
export function signOutWithWarning(me: Profile) {
  if (me.anonymous && !confirm('أنت منضم بالرمز بلا حساب جوجل. إن خرجت ستحتاج رمز الدعوة وموافقة مدير الأسرة من جديد. هل تخرج؟')) return;
  api.signOut();
}

/**
 * حساب بلا أسرة:
 * - من دخل بجوجل ينشئ أسرته (فيصير مديرها) أو ينضم برمز دعوة.
 * - من دخل بلا حساب ينضم برمز دعوة فقط ويكتب اسمه.
 */
export function Onboarding({ me, onDone }: { me: Profile; onDone: () => void }) {
  const [name, setName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await fn(); onDone(); } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className="center">
      <div className="login card">
        <img src="./icon.svg" alt="" width={56} height={56} />
        <h1>{me.anonymous ? 'الانضمام إلى أسرة' : `مرحباً ${me.full_name ?? ''}`}</h1>
        {error && <p className="error" role="alert">{error}</p>}

        {!me.anonymous && (
          <>
            <form className="form block" onSubmit={(e) => { e.preventDefault(); go(() => api.createHousehold(name)); }}>
              <h2>أسرة جديدة</h2>
              <p className="muted small">تبدأ ميزانية أسرتك وتصبح مديرها، ثم تدعو أفرادها برمز دعوة.</p>
              <input placeholder="اسم الأسرة، مثال: أسرة أحمد" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn primary" disabled={busy}>إنشاء الأسرة</button>
            </form>
            <div className="divider muted small">أو</div>
          </>
        )}

        <form className="form block" onSubmit={(e) => { e.preventDefault(); go(() => api.joinHousehold(code, me.anonymous ? memberName : undefined)); }}>
          {!me.anonymous && <h2>الانضمام إلى أسرة</h2>}
          <p className="muted small">أدخل رمز الدعوة الذي أرسله لك مدير أسرتك. ستدخل بعد موافقته.</p>
          {me.anonymous && (
            <input placeholder="اسمك كما يعرفك أهلك" required maxLength={60} autoComplete="name" value={memberName} onChange={(e) => setMemberName(e.target.value)} />
          )}
          <input placeholder="رمز الدعوة" required dir="ltr" autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className={me.anonymous ? 'btn primary' : 'btn'} disabled={busy}>طلب الانضمام</button>
        </form>

        <button className="link small" onClick={() => api.signOut()}>{me.anonymous ? 'رجوع' : `تسجيل الخروج (${me.email})`}</button>
      </div>
    </div>
  );
}

/** انضم برمز دعوة وينتظر موافقة المدير (أو أوقفه المدير) */
export function Pending({ me, onRefresh }: { me: Profile; onRefresh: () => void }) {
  const [household, setHousehold] = useState<Household | null>(null);
  useEffect(() => { api.getHousehold().then(setHousehold).catch(() => {}); }, []);

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
          مرحباً {me.full_name}. وصل طلبك{household ? ` إلى «${household.name}»` : ''}، وسيظهر لمدير الأسرة في شاشة الإدارة ليمنحك الصلاحية.
        </p>
        {me.anonymous && <p className="muted small">ابقَ على هذا المتصفح نفسه: طلبك مرتبط به، ولا تمسح بياناته.</p>}
        <button className="btn primary block" onClick={onRefresh}>تحديث</button>
        {me.household_id !== 'legacy' && <button className="btn block" onClick={cancel}>سحب الطلب</button>}
        {!me.anonymous && <button className="link small" onClick={() => api.signOut()}>تسجيل الخروج ({me.email})</button>}
      </div>
    </div>
  );
}
