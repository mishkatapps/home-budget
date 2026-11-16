import { useEffect, useMemo, useState } from 'react';
import ExpenseForm from '../components/ExpenseForm';
import { MonthNav } from '../components/ui';
import { api } from '../lib/api';
import { dateTimeLabel, dayLabel, money, moneyExact, monthEnd, monthStart } from '../lib/format';
import type { Expense } from '../lib/types';
import { avatarOf, nameOf, useStore } from '../store';

export default function Expenses({ ym, setYm }: { ym: string; setYm: (ym: string) => void }) {
  const { categories, beneficiaries, profiles, me, isAdmin, canWrite, version } = useStore();
  const [list, setList] = useState<Expense[] | null>(null);
  const [editing, setEditing] = useState<Expense | null | 'new'>(null);
  const [cat, setCat] = useState('');
  const [ben, setBen] = useState('');
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let live = true;
    setList(null);
    api.listExpenses(monthStart(ym), monthEnd(ym)).then((r) => live && setList(r)).catch(() => live && setList([]));
    return () => { live = false; };
  }, [ym, version]);

  const filtered = useMemo(
    () => (list ?? []).filter((e) =>
      (!cat || e.category_id === Number(cat)) &&
      (!ben || e.beneficiary_id === Number(ben)) &&
      (!who || e.created_by === who) &&
      (!q || (e.notes ?? '').includes(q.trim()))),
    [list, cat, ben, who, q],
  );
  const days = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const e of filtered) m.set(e.paid_on, [...(m.get(e.paid_on) ?? []), e]);
    return [...m.entries()];
  }, [filtered]);

  const canEdit = (e: Expense) => isAdmin || (canWrite && e.created_by === me.id);
  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const members = profiles.filter((p) => p.role !== 'pending');

  return (
    <>
      <MonthNav ym={ym} setYm={setYm} />

      <div className="filters card">
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="البند">
          <option value="">كل البنود</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={ben} onChange={(e) => setBen(e.target.value)} aria-label="المستفيد">
          <option value="">كل المستفيدين</option>
          {beneficiaries.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="من سجّل">
          <option value="">كل الأعضاء</option>
          {members.map((p) => <option key={p.id} value={p.id}>{p.avatar ? p.avatar + ' ' : ''}{p.full_name}</option>)}
        </select>
        <input type="search" placeholder="بحث في الملاحظات" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="toolbar">
        <span className="grow">{filtered.length} عملية · الإجمالي <b className="num">{money(total)}</b></span>
      </div>

      {list === null && <p className="muted">جارٍ التحميل…</p>}
      {list && !filtered.length && <p className="muted card section">لا توجد مصروفات مطابقة في هذا الشهر.</p>}

      {days.map(([day, items]) => (
        <section className="card section" key={day}>
          <div className="section-head">
            <h2>{dayLabel(day)}</h2>
            <b className="num">{money(items.reduce((s, e) => s + e.amount, 0))}</b>
          </div>
          <ul className="rows">
            {items.map((e) => (
              <li key={e.id} className={canEdit(e) ? 'clickable' : ''} onClick={() => canEdit(e) && setEditing(e)} title={`سُجّل في ${dateTimeLabel(e.created_at)}`}>
                <span className="avatar" aria-hidden="true">{avatarOf(profiles, e.created_by) ?? '·'}</span>
                <div className="grow">
                  <div>{nameOf(categories, e.category_id)}{e.receipt_path ? ' 📎' : ''}</div>
                  <div className="muted small">
                    {[e.notes, nameOf(beneficiaries, e.beneficiary_id), e.created_by ? `سجّله ${nameOf(profiles, e.created_by)}` : ''].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <b className="num">{moneyExact(e.amount)}</b>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {canWrite && <button className="fab" onClick={() => setEditing('new')} aria-label="تسجيل مصروف">+</button>}
      {editing && <ExpenseForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
