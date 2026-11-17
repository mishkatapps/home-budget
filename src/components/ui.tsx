import { useState, type ReactNode } from 'react';
import { currentYm, money, shiftYm, ymLabel } from '../lib/format';
import { EN, T } from '../lib/i18n';

export function MonthNav({ ym, setYm }: { ym: string; setYm: (ym: string) => void }) {
  return (
    <div className="monthnav">
      <button className="btn icon" onClick={() => setYm(shiftYm(ym, -1))} aria-label="الشهر السابق">{EN ? '‹' : '›'}</button>
      <div className="monthnav-label">
        <strong>{ymLabel(ym)}</strong>
        {ym !== currentYm() && <button className="link small" onClick={() => setYm(currentYm())}>الشهر الحالي</button>}
      </div>
      <button className="btn icon" onClick={() => setYm(shiftYm(ym, 1))} aria-label="الشهر التالي">{EN ? '›' : '‹'}</button>
    </div>
  );
}

export function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className="tile card">
      <div className="muted small">{label}</div>
      <div className={`tile-value ${tone ?? ''}`}>{value}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}

/** أشرطة أفقية للمقارنة بين بنود (لون واحد: القيمة هي المقصودة لا الهوية) */
export function HBars({ rows, limit = 8 }: { rows: { label: string; value: number; note?: string }[]; limit?: number }) {
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const shown = all ? rows : rows.slice(0, limit);
  if (!rows.length) return <p className="muted">لا توجد بيانات.</p>;
  return (
    <div className="hbars">
      {shown.map((r) => (
        <div className="hbar" key={r.label} title={`${r.label}: ${money(r.value)} (${Math.round((r.value / total) * 100)}%)`}>
          <div className="hbar-head">
            <span>{r.label}</span>
            <span className="num">{money(r.value)} <span className="muted small">{Math.round((r.value / total) * 100)}%</span></span>
          </div>
          <div className="track"><div className="fill" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          {r.note && <div className="muted small">{r.note}</div>}
        </div>
      ))}
      {rows.length > limit && (
        <button className="link" onClick={() => setAll(!all)}>{all ? 'عرض أقل' : T(`عرض الكل (${rows.length})`, `Show all (${rows.length})`)}</button>
      )}
    </div>
  );
}

/** مؤشر صرف مقابل ميزانية؛ الحالة تُكتب نصاً ولا تعتمد على اللون وحده */
export function Meter({ label, spent, budget }: { label: string; spent: number; budget: number }) {
  const ratio = budget > 0 ? spent / budget : 0;
  const state = ratio > 1 ? 'over' : ratio > 0.85 ? 'warn' : 'ok';
  const text = ratio > 1 ? T(`⚠ تجاوز بـ ${money(spent - budget)}`, `⚠ Over by ${money(spent - budget)}`) : T(`متبقي ${money(budget - spent)}`, `${money(budget - spent)} left`);
  return (
    <div className="hbar">
      <div className="hbar-head">
        <span>{label}</span>
        <span className="num">{money(spent)} <span className="muted small">من {money(budget)}</span></span>
      </div>
      <div className="track"><div className={`fill ${state}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
      <div className="muted small">{text} · {Math.round(ratio * 100)}%</div>
    </div>
  );
}

/** ميزانية عضو بأرقام بارزة: المتبقي كبير وملوّن، والحالة مكتوبة نصاً لا باللون وحده */
export function MemberBudget({ name, spent, budget, self }: { name: string; spent: number; budget: number; self?: boolean }) {
  const ratio = budget > 0 ? spent / budget : 0;
  const state = ratio > 1 ? 'over' : ratio > 0.85 ? 'warn' : 'ok';
  const left = budget - spent;
  return (
    <div className={`member-budget ${state} ${self ? 'self' : ''}`}>
      <div className="mb-head">
        <b>{name}</b>{self && <span className="chip">أنت</span>}
        <span className="mb-state">{state === 'over' ? '⚠ تجاوز الميزانية' : state === 'warn' ? 'قارب على النهاية' : 'في الحدود'}</span>
      </div>
      <div className="mb-figures">
        <div><span className="muted small">{left < 0 ? 'التجاوز' : 'المتبقي'}</span><strong className="mb-left num">{money(Math.abs(left))}</strong></div>
        <div><span className="muted small">صُرف</span><strong className="num">{money(spent)}</strong></div>
        <div><span className="muted small">الميزانية</span><strong className="num">{money(budget)}</strong></div>
      </div>
      <div className="track"><div className={`fill ${state}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
      <div className="muted small">{Math.round(ratio * 100)}% من الميزانية</div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-label={title}>
        <div className="modal-head">
          <strong>{title}</strong>
          <button className="btn icon" onClick={onClose} aria-label="إغلاق">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card section">
      <div className="section-head"><h2>{title}</h2>{action}</div>
      {children}
    </section>
  );
}
