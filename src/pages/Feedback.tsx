import { useState } from 'react';
import { Section } from '../components/ui';
import { useStore } from '../store';
import { LANG, T } from '../lib/i18n';

/**
 * التقييمات تُرسل إلى نفس جدول Google الذي تستقبل فيه مشكاة تقييمات تطبيقاتها (عبر Google Apps Script)،
 * فتظهر في تبويب «التقييمات» بصفحة إدارة موقع مشكاة مع تقييمات روض الذكر وغيره.
 */
const FEEDBACK_URL = 'https://script.google.com/macros/s/AKfycbx7bW5v7gXQoxEnddpVrXE5rknGVUZ55FRNHr_ZLXdn1Sg3mFF_4qpRAjUbTVmW09E0Cg/exec';
const LABELS = ['', 'ضعيف', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'];

function platformName(): string {
  const ua = navigator.userAgent;
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iOS' : /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'Mac' : 'Other';
  return os + (matchMedia('(display-mode: standalone)').matches ? ' · PWA' : ' · Web');
}

/** معرّف عشوائي للجهاز (لا يحمل أي بيانات شخصية) حتى يُعرف تكرار التقييم من الجهاز نفسه */
function deviceId(): string {
  try {
    let d = localStorage.getItem('feedbackDevice');
    if (!d) { d = 'd' + Math.random().toString(36).slice(2, 10); localStorage.setItem('feedbackDevice', d); }
    return d;
  } catch { return 'd-unknown'; }
}

export default function Feedback() {
  const { me } = useStore();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [name, setName] = useState(me.full_name ?? '');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!stars && !text.trim()) return setError('اختر عدد النجوم أو اكتب اقتراحك.');
    setError(null);
    setState('sending');
    const body = new URLSearchParams({
      app: 'ميزانية البيت', ver: __APP_VERSION__, platform: platformName(), lang: LANG,
      stars: String(stars), text: text.trim(), name: name.trim(), contact: contact.trim(), device: deviceId(),
    });
    try {
      // Apps Script لا يسمح بقراءة الرد من موقع آخر؛ الإرسال بلا قراءة الرد هو الطريقة المعتمدة في تطبيقات مشكاة
      await fetch(FEEDBACK_URL, { method: 'POST', mode: 'no-cors', body });
      setState('sent');
    } catch {
      setState('idle');
      setError('تعذر الإرسال. تحقق من اتصال الإنترنت ثم حاول مرة أخرى.');
    }
  }

  if (state === 'sent') {
    return (
      <Section title="قيّم التطبيق">
        <p>💚 جزاك الله خيراً، وصل تقييمك إلى فريق مشكاة وسنقرأ كل اقتراح باهتمام.</p>
        <button className="link" onClick={() => { setState('idle'); setStars(0); setText(''); }}>إرسال تقييم آخر</button>
      </Section>
    );
  }
  return (
    <Section title="قيّم التطبيق">
      <p className="muted small">تقييمك واقتراحاتك تصل مباشرة إلى فريق مشكاة وتساعد على تطوير التطبيق.</p>
      <form className="form" onSubmit={send}>
        <div className="rate-stars" role="radiogroup" aria-label="التقييم">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={T(`${n} من 5`, `${n} of 5`)} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>★</button>
          ))}
          <span className="muted small">{stars ? LABELS[stars] : 'اضغط على النجوم'}</span>
        </div>
        <label>اقتراحات أو تعديلات تحب إضافتها (اختياري)
          <textarea rows={4} maxLength={2000} placeholder="مثال: أتمنى إضافة…" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label>اسمك (اختياري)<input maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>وسيلة تواصل إن أردت رداً (اختياري)<input maxLength={80} dir="auto" placeholder="بريد أو رقم واتساب" value={contact} onChange={(e) => setContact(e.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={state === 'sending'}>{state === 'sending' ? 'جارٍ الإرسال…' : 'إرسال التقييم'}</button>
      </form>
    </Section>
  );
}
