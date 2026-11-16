import { useState } from 'react';
import { Section } from '../components/ui';
import { api } from '../lib/api';
import { collect, decryptBackup, encryptBackup, excelFile, readExcel, saveOrShare } from '../lib/backup';
import { todayStr } from '../lib/format';
import type { LegacyExport } from '../lib/types';
import { useStore } from '../store';

/** النسخ الاحتياطي المشفّر (للحفظ في Google Drive أو غيره) والتصدير والاستيراد عبر Excel — لمدير الأسرة */
export default function Backup() {
  const { categories, beneficiaries, incomes, household, run } = useStore();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [restorePw, setRestorePw] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const name = household?.name ?? 'الأسرة';
  const stamp = todayStr();

  /** ينفّذ عملية ويعرض نتيجتها أو خطأها في سطر الحالة */
  async function task(start: string, fn: () => Promise<string>) {
    setBusy(true);
    setStatus(start);
    try { setStatus(await fn()); } catch (e) { setStatus('⚠ ' + (e as Error).message); }
    setBusy(false);
  }

  async function importData(data: LegacyExport): Promise<string> {
    let result = { incomes: 0, expenses: 0 };
    const ok = await run(async () => {
      result = await api.importLegacy(data, (done, total) => setStatus(`جارٍ الاستيراد… ${done} / ${total}`));
    });
    if (!ok) throw new Error('لم يكتمل الاستيراد.');
    const skippedRows = data.expenses.length + data.incomes.length - result.expenses - result.incomes;
    return `تم: أُضيف ${result.expenses} مصروف و ${result.incomes} دخل.${skippedRows > 0 ? ` ${skippedRows} صف موجود من قبل فلم يتكرر.` : ''}`;
  }

  function backup(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return setStatus('⚠ كلمة السر 6 أحرف على الأقل.');
    if (pw !== pw2) return setStatus('⚠ كلمتا السر غير متطابقتين.');
    task('جارٍ تجهيز النسخة وتشفيرها…', async () => {
      const data = await collect(categories, beneficiaries, incomes);
      const how = await saveOrShare(await encryptBackup(data, pw, name), `ميزانية-البيت-${stamp}.mbk`);
      setPw(''); setPw2('');
      return `${how === 'shared' ? 'تمت المشاركة' : 'نُزِّل الملف'}: ${data.expenses.length} مصروف و ${data.incomes.length} دخل، مشفّرة بكلمة السر.${how === 'downloaded' ? ' ارفعه إلى Google Drive لحفظه.' : ''}`;
    });
  }

  function restore(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreFile) return;
    task('جارٍ فك التشفير…', async () => {
      const data = await decryptBackup(restoreFile, restorePw);
      setRestorePw(''); setRestoreFile(null);
      return importData(data);
    });
  }

  const exportExcel = () => task('جارٍ تجهيز ملف Excel…', async () => {
    const data = await collect(categories, beneficiaries, incomes);
    await saveOrShare(await excelFile(data, categories.map((c) => c.name)), `ميزانية-البيت-${stamp}.xlsx`);
    return `صُدِّر ${data.expenses.length} مصروف و ${data.incomes.length} دخل إلى Excel. هذا الملف غير مشفّر.`;
  });

  const template = () => task('جارٍ تجهيز القالب…', async () => {
    await saveOrShare(await excelFile(null, categories.filter((c) => c.active).map((c) => c.name)), 'قالب-ميزانية-البيت.xlsx');
    return 'نُزِّل القالب. املأه ثم استورده من الزر المجاور.';
  });

  const importExcel = (file: File | undefined) => file && task('جارٍ قراءة الملف…', async () => {
    const { data, skipped } = await readExcel(file);
    if (!data.expenses.length && !data.incomes.length) throw new Error('لا توجد صفوف صالحة في الملف.' + (skipped.length ? ' ' + skipped.slice(0, 3).join('؛ ') : ''));
    const msg = await importData(data);
    return msg + (skipped.length ? ` تُخطّي ${skipped.length} صف: ${skipped.slice(0, 3).join('؛ ')}${skipped.length > 3 ? '…' : ''}` : '');
  });

  return (
    <Section title="النسخ الاحتياطي والاستيراد" action={<button className="link" onClick={() => setOpen(!open)}>{open ? 'إخفاء' : 'عرض'}</button>}>
      <p className="muted small">احفظ نسخة مشفّرة من بيانات أسرتك في Google Drive، أو صدّرها واستوردها عبر Excel.</p>
      {status && <p className={status.startsWith('⚠') ? 'error' : ''} role="status">{status}</p>}
      {open && (
        <>
          {incomes === null && <p className="notice small">الدخل مقفل الآن، فلن يدخل في النسخة أو التصدير. افتح قفل الدخل من «الرئيسية» أولاً إن أردته ضمنها.</p>}

          <h3>نسخة احتياطية مشفّرة</h3>
          <p className="muted small">تُشفَّر على جهازك بكلمة سر تختارها قبل أن تغادره. لا يقرؤها أحد بدونها، ولا نستطيع استرجاعها إن نسيتها. صور الفواتير وأسماء من سجّل غير مشمولة.</p>
          <form className="form" onSubmit={backup}>
            <label>كلمة سر النسخة<input type="password" autoComplete="new-password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
            <label>أعد كتابتها<input type="password" autoComplete="new-password" minLength={6} required value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
            <button className="btn primary" disabled={busy}>إنشاء النسخة وحفظها في Google Drive</button>
          </form>
          <p className="muted small">على الهاتف تظهر قائمة المشاركة: اختر «Drive». على الحاسب يُنزَّل الملف فترفعه إلى Drive.</p>

          <h3>استرجاع نسخة مشفّرة</h3>
          <form className="form" onSubmit={restore}>
            <label className="btn">{restoreFile ? restoreFile.name : 'اختيار ملف النسخة (‎.mbk)'}
              <input type="file" accept=".mbk,application/octet-stream" hidden onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)} />
            </label>
            <label>كلمة سر النسخة<input type="password" autoComplete="off" required value={restorePw} onChange={(e) => setRestorePw(e.target.value)} /></label>
            <button className="btn" disabled={busy || !restoreFile}>استرجاع البيانات</button>
          </form>
          <p className="muted small">الاسترجاع يضيف ما ينقص ولا يحذف شيئاً، وما هو موجود لا يتكرر.</p>

          <h3>Excel</h3>
          <div className="inline wrap">
            <button className="btn" disabled={busy} onClick={exportExcel}>تصدير البيانات إلى Excel</button>
            <button className="btn" disabled={busy} onClick={template}>تنزيل قالب الاستيراد</button>
            <label className="btn">استيراد من Excel
              <input type="file" accept=".xlsx" hidden disabled={busy} onChange={(e) => { importExcel(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          <p className="muted small">القالب فيه ورقة للمصروفات وورقة للدخل وورقة تعليمات. الدخل المستورد يُسجَّل باسمك أنت.</p>
        </>
      )}
    </Section>
  );
}
