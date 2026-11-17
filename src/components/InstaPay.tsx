import { useState } from 'react';

// حساب InstaPay نفسه المستخدم في صفحة «ادعم مشكاة» (mishkatapps.github.io/support.html)
const ADDRESS = 'moshen2026@instapay';
const PAY_URL = 'https://ipn.eg/C/Q/moshen2026/instapay?ISIGN=23052603MEUCIQCB/caVkAj879K/uDiPj2rXI0mT+feDQupgvva37LHEvgIgfxEdjo/IOCdGlkMOQJPYHdv1MvuhF2Zzip2uxgTTn94=';

/** بطاقة الدفع عبر InstaPay: رمز QR، العنوان، زر الدفع، ونسخ العنوان */
export default function InstaPay({ amount, currency }: { amount?: number; currency?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try { await navigator.clipboard.writeText(ADDRESS); }
    catch {
      const t = Object.assign(document.createElement('textarea'), { value: ADDRESS });
      document.body.append(t); t.select();
      try { document.execCommand('copy'); } catch { /* غير مدعوم */ }
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="instapay">
      <div className="ip-via">التحويل عبر</div>
      <div className="ip-name">InstaPay</div>
      {amount != null && <div className="ip-amount">المبلغ: <b className="num">{amount.toLocaleString('en')}</b> {currency ?? 'جنيه'}</div>}
      <div className="ip-qr"><img src="./instapay-qr.svg" alt="رمز QR للتحويل عبر InstaPay" /></div>
      <div className="ip-addr" dir="ltr">{ADDRESS}</div>
      <div className="ip-btns">
        <a className="btn primary" href={PAY_URL} target="_blank" rel="noopener noreferrer">ادفع عبر InstaPay ↗</a>
        <button type="button" className="btn" onClick={copy}>{copied ? 'تم النسخ ✓' : 'نسخ العنوان'}</button>
      </div>
      <small className="muted">من جوال آخر: امسح الرمز بكاميرا الهاتف أو من تطبيق InstaPay</small>
    </div>
  );
}
