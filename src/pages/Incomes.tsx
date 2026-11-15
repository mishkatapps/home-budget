import { useMemo, useState } from 'react';
import { Modal } from '../components/ui';
import { api } from '../lib/api';
import { dayLabel, moneyExact, todayStr, ymLabel } from '../lib/format';
import type { Income, IncomeInput } from '../lib/types';
import { nameOf, useStore } from '../store';

function IncomeForm({ initial, onClose }: { initial: Income | null; onClose: () => void }) {
  const { run } = useStore();
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [date, setDate] = useState(initial?.received_on ?? todayStr());
  const [source, setSource] = useState(initial?.source ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const input: IncomeInput = { amount: Number(amount), received_on: date, source: source.trim() || null, notes: notes.trim() || null };
    if (initial) input.id = initial.id;
    setBusy(true);
    if (await run(() => api.saveIncome(input))) onClose(); else setBusy(false);
  }
  async function del() {
    if (!initial || !confirm('حذف هذا الدخل؟')) return;
    setBusy(true);
    if (await run(() => api.deleteIncome(initial.id))) onClose(); else setBusy(false);
  }

  return (
    <Modal title={initial ? 'تعديل دخل' : 'تسجيل دخل'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>المبلغ<input type="number" inputMode="decimal" step="0.01" min="0.01" required autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>تاريخ الاستلام<input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>المصدر<input value={source} placeholder="مثال: الراتب، مكافأة، إيجار" onChange={(e) => setSource(e.target.value)} /></label>
        <label>ملاحظات<input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="form-actions">
          <button className="btn primary" disabled={busy}>حفظ</button>
          {initial && <button type="button" className="btn danger" disabled={busy} onClick={del}>حذف</button>}
        </div>
      </form>
    </Modal>
  );
}

export default function Incomes() {
  const { incomes, isAdmin, profiles } = useStore();
  const [editing, setEditing] = useState<Income | null | 'new'>(null);
  const [limit, setLimit] = useState(12);

  const groups = useMemo(() => {
    const m = new Map<string, Income[]>();
    for (const i of [...incomes].sort((a, b) => b.received_on.localeCompare(a.received_on) || b.id - a.id)) {
      const ym = i.received_on.slice(0, 7);
      m.set(ym, [...(m.get(ym) ?? []), i]);
    }
    return [...m.entries()];
  }, [incomes]);

  return (
    <>
      <div className="toolbar">
        <p className="muted small grow">يمكن تسجيل دخل الشهر دفعة واحدة أو على عدة دفعات؛ يُجمع تلقائياً لكل شهر.</p>
        {isAdmin && <button className="btn primary" onClick={() => setEditing('new')}>+ تسجيل دخل</button>}
      </div>
      {!isAdmin && <p className="muted small">تسجيل الدخل وتعديله من صلاحيات مدير الأسرة.</p>}
      {!groups.length && <p className="muted card section">لم يُسجَّل أي دخل بعد.</p>}

      {groups.slice(0, limit).map(([ym, list]) => (
        <section className="card section" key={ym}>
          <div className="section-head">
            <h2>{ymLabel(ym)}</h2>
            <b className="num">{moneyExact(list.reduce((s, i) => s + i.amount, 0))}</b>
          </div>
          <ul className="rows">
            {list.map((i) => (
              <li key={i.id} className={isAdmin ? 'clickable' : ''} onClick={() => isAdmin && setEditing(i)}>
                <div className="grow">
                  <div>{i.source || 'دخل'}</div>
                  <div className="muted small">
                    {dayLabel(i.received_on)}{i.notes ? ` · ${i.notes}` : ''}{i.created_by ? ` · سجّله ${nameOf(profiles, i.created_by)}` : ''}
                  </div>
                </div>
                <b className="num">{moneyExact(i.amount)}</b>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {groups.length > limit && <button className="btn block" onClick={() => setLimit(limit + 24)}>عرض شهور أقدم</button>}

      {editing && <IncomeForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
