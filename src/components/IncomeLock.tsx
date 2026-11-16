import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { biometricAvailable, clearLock, enrollBiometric, hasBiometric, hasLock, setPin, verifyBiometric, verifyPin } from '../lib/lock';
import { useStore } from '../store';

const PIN_RE = /^\d{4,8}$/;

/** نموذج فتح أو إعداد قفل الدخل. عند النجاح يجلب التطبيق بيانات الدخل من الخادم. */
export function UnlockForm({ onDone }: { onDone?: () => void }) {
  const { me, unlockIncome } = useStore();
  const [configured, setConfigured] = useState(() => hasLock(me.id));
  const [bioOk, setBioOk] = useState(false);
  const [pin, setPinValue] = useState('');
  const [pin2, setPin2] = useState('');
  const [useBio, setUseBio] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);

  useEffect(() => { biometricAvailable().then(setBioOk); }, []);

  // من فعّل البصمة: يطلبها الجهاز فور ظهور القفل بلا ضغط زر. إن ألغاها يبقى الزر والرمز.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || !hasLock(me.id) || !hasBiometric(me.id)) return;
    asked.current = true;
    verifyBiometric(me.id).then((ok) => { if (ok) open(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function open() { await unlockIncome(); onDone?.(); }

  async function setup(e: React.FormEvent) {
    e.preventDefault();
    if (!PIN_RE.test(pin)) return setError('الرمز من 4 إلى 8 أرقام.');
    if (pin !== pin2) return setError('الرمزان غير متطابقين.');
    setBusy(true);
    setError(null);
    try {
      await setPin(me.id, pin);
      if (bioOk && useBio) {
        try { await enrollBiometric(me.id, me.full_name ?? 'مدير الأسرة'); }
        catch { setError('لم تُفعَّل بصمة الإصبع؛ سيُستخدم الرمز فقط.'); }
      }
      setConfigured(true);
      await open();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  async function byPin(e: React.FormEvent) {
    e.preventDefault();
    if (Date.now() < waitUntil) return setError(`انتظر ${Math.ceil((waitUntil - Date.now()) / 1000)} ثانية ثم حاول.`);
    setBusy(true);
    if (await verifyPin(me.id, pin)) { setFails(0); await open(); }
    else {
      const n = fails + 1;
      setFails(n);
      setPinValue('');
      if (n >= 5) { setWaitUntil(Date.now() + 30_000); setFails(0); setError('خمس محاولات خاطئة. انتظر 30 ثانية.'); }
      else setError('الرمز غير صحيح.');
    }
    setBusy(false);
  }

  async function byBio() {
    setBusy(true);
    setError(null);
    if (await verifyBiometric(me.id)) await open();
    else setError('لم يتم التحقق ببصمة الإصبع. استخدم الرمز.');
    setBusy(false);
  }

  function forgot() {
    if (!confirm('سيُحذف قفل الدخل من هذا الجهاز وتُسجَّل خارجاً. بعد الدخول من جديد تضبط رمزاً جديداً. بيانات الدخل لا تتأثر. هل تتابع؟')) return;
    clearLock(me.id);
    api.signOut();
  }

  if (!configured) {
    return (
      <form className="form" onSubmit={setup}>
        <p className="small">اضبط رمزاً سرياً لبيانات الدخل على هذا الجهاز. بدونه لا يظهر الدخل حتى لمن يمسك هاتفك.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <label>رمز سري (4 إلى 8 أرقام)
          <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} required value={pin} onChange={(e) => setPinValue(e.target.value)} />
        </label>
        <label>أعد كتابة الرمز
          <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} required value={pin2} onChange={(e) => setPin2(e.target.value)} />
        </label>
        {bioOk && (
          <label className="check"><input type="checkbox" checked={useBio} onChange={(e) => setUseBio(e.target.checked)} /> فتح ببصمة الإصبع تلقائياً</label>
        )}
        <button className="btn primary" disabled={busy}>حفظ وفتح بيانات الدخل</button>
      </form>
    );
  }

  return (
    <form className="form" onSubmit={byPin}>
      {error && <p className="error" role="alert">{error}</p>}
      {hasBiometric(me.id) && (
        <>
          <button type="button" className="btn primary" disabled={busy} onClick={byBio}>إعادة طلب بصمة الإصبع</button>
          <div className="divider muted small">أو بالرمز</div>
        </>
      )}
      <label>الرمز السري
        <input type="password" inputMode="numeric" autoComplete="off" maxLength={8} required autoFocus={!hasBiometric(me.id)} value={pin} onChange={(e) => setPinValue(e.target.value)} />
      </label>
      <button className={hasBiometric(me.id) ? 'btn' : 'btn primary'} disabled={busy}>فتح</button>
      <button type="button" className="link small" onClick={forgot}>نسيت الرمز</button>
    </form>
  );
}

/** يعرض المحتوى فقط للمدير وبعد فتح القفل؛ وإلا يعرض نموذج الفتح */
export function IncomeGate({ children }: { children: ReactNode }) {
  const { isAdmin, incomes } = useStore();
  if (!isAdmin) return <p className="card section muted">بيانات الدخل خاصة بمدير الأسرة.</p>;
  if (incomes === null) {
    return (
      <section className="card section">
        <div className="section-head"><h2>🔒 بيانات الدخل مقفلة</h2></div>
        <UnlockForm />
      </section>
    );
  }
  return <>{children}</>;
}
