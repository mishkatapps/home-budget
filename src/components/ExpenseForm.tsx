import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { moneyExact, todayStr } from '../lib/format';
import type { Expense, ExpenseInput, ReceiptResult } from '../lib/types';
import { useStore } from '../store';
import { Modal } from './ui';

/** يصغّر صورة الفاتورة إلى JPEG بحد أقصى 1280 بكسل: كافٍ للقراءة وخفيف على الخادم المجاني */
async function shrinkImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('تعذرت معالجة الصورة'))), 'image/jpeg', 0.75));
}

export default function ExpenseForm({ initial, onClose }: { initial: Expense | null; onClose: () => void }) {
  const { categories, beneficiaries, run } = useStore();
  const cats = categories.filter((c) => c.active || c.id === initial?.category_id);
  const bens = beneficiaries.filter((b) => b.active || b.id === initial?.beneficiary_id);

  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState<number | ''>(initial?.category_id ?? '');
  const [date, setDate] = useState(initial?.paid_on ?? todayStr());
  const [beneficiaryId, setBeneficiaryId] = useState<number | ''>(initial ? (initial.beneficiary_id ?? '') : (bens[0]?.id ?? ''));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [receipt, setReceipt] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ReceiptResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initial?.receipt_path) api.receiptUrl(initial.receipt_path).then(setPreview);
  }, [initial]);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setStatus('جارٍ تجهيز الصورة…');
    try {
      const blob = await shrinkImage(file);
      setReceipt(blob);
      setPreview(URL.createObjectURL(blob));
      setAnalysis(null);
      setStatus(null);
    } catch (e) { setStatus((e as Error).message); }
  }

  async function analyze() {
    if (!receipt) return;
    setBusy(true);
    setStatus('جارٍ تحليل الفاتورة…');
    try {
      const r = await api.analyzeReceipt(receipt, cats.map((c) => c.name));
      setAnalysis(r);
      if (r.total != null) setAmount(String(r.total));
      if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) setDate(r.date);
      const cat = cats.find((c) => c.name === r.category);
      if (cat) setCategoryId(cat.id);
      const text = [r.merchant, r.items.map((i) => i.name).join(' - ')].filter(Boolean).join(': ');
      if (text) setNotes(text.slice(0, 250));
      setStatus('تم ملء البيانات من الفاتورة — راجعها قبل الحفظ.');
    } catch (e) { setStatus((e as Error).message); }
    setBusy(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (categoryId === '') return;
    const input: ExpenseInput = {
      amount: Number(amount), category_id: categoryId, paid_on: date,
      beneficiary_id: beneficiaryId === '' ? null : beneficiaryId, notes: notes.trim() || null,
    };
    if (initial) input.id = initial.id;
    setBusy(true);
    if (await run(() => api.saveExpense(input, receipt))) onClose(); else setBusy(false);
  }

  async function del() {
    if (!initial || !confirm('حذف هذا المصروف؟')) return;
    setBusy(true);
    if (await run(() => api.deleteExpense(initial.id))) onClose(); else setBusy(false);
  }

  return (
    <Modal title={initial ? 'تعديل مصروف' : 'تسجيل مصروف'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="receipt">
          <label className="btn">
            📷 {preview ? 'تغيير صورة الفاتورة' : 'صورة فاتورة'}
            {/* بدون capture: الهاتف يعرض الكاميرا أو المعرض، والحاسب يفتح اختيار ملف */}
            <input type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
          {receipt && <button type="button" className="btn primary" disabled={busy} onClick={analyze}>تحليل الفاتورة</button>}
        </div>
        {status && <p className="muted small" role="status">{status}</p>}
        {preview && <a href={preview} target="_blank" rel="noreferrer"><img className="receipt-img" src={preview} alt="صورة الفاتورة" /></a>}
        {analysis && analysis.items.length > 0 && (
          <details className="small">
            <summary>الأصناف المقروءة ({analysis.items.length})</summary>
            <ul className="items">
              {analysis.items.map((i, k) => <li key={k}><span>{i.name}</span><span className="num">{i.price != null ? moneyExact(i.price) : ''}</span></li>)}
            </ul>
          </details>
        )}

        <label>المبلغ<input type="number" inputMode="decimal" step="0.01" min="0.01" required autoFocus={!initial} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>البند
          <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">— اختر البند —</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>التاريخ<input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>المستفيد
          <select value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">غير محدد</option>
            {bens.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label>ملاحظات<input value={notes} maxLength={250} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="form-actions">
          <button className="btn primary" disabled={busy}>حفظ</button>
          {initial && <button type="button" className="btn danger" disabled={busy} onClick={del}>حذف</button>}
        </div>
      </form>
    </Modal>
  );
}
