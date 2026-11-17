import { useMemo, useState } from 'react';
import { UnlockForm } from '../components/IncomeLock';
import { HBars, MemberBudget, Meter, Modal, MonthNav, Section, Tile } from '../components/ui';
import { api } from '../lib/api';
import { currentYm, daysInMonth, money, moneyExact, shiftYm, todayStr, ymLabel } from '../lib/format';
import { balanceUpTo, groupSum, monthTotals, sortedEntries } from '../lib/stats';
import type { Profile } from '../lib/types';
import { budgetOf, nameOf, useStore } from '../store';
import { T } from '../lib/i18n';

const label = (p: Profile) => `${p.avatar ? p.avatar + ' ' : ''}${p.full_name ?? p.email ?? ''}`;

/** جدول منح المصروف: دفعات على مدار الشهر، المتبقي مع كل عضو، وترحيل متبقي الشهر السابق بموافقة المدير */
function GrantsTable({ ym, spentBy }: { ym: string; spentBy: (memberId: string, month: string) => number }) {
  const { profiles, budgets, myGrants, run } = useStore();
  const [adding, setAdding] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const prev = shiftYm(ym, -1);
  const members = profiles.filter((p) => p.role !== 'pending');
  const admins = profiles.filter((p) => p.role === 'admin').length;

  async function add(e: React.FormEvent, memberId: string) {
    e.preventDefault();
    if (await run(() => api.addGrant(memberId, ym, Number(amount), note.trim() || undefined))) { setAdding(null); setAmount(''); setNote(''); }
  }

  return (
    <div className="grants">
      <h3>المصروف الممنوح في {ymLabel(ym)}</h3>
      <p className="muted small">امنح كل فرد مصروفه دفعة واحدة أو على دفعات خلال الشهر، ولنفسك أيضاً. ما يُمنح هنا هو ميزانية الأسرة التي يراها الجميع.</p>
      {members.map((p) => {
        const budget = budgetOf(budgets, ym, p.id);
        const row = budgets.find((b) => b.ym === ym && b.member_id === p.id);
        const spent = spentBy(p.id, ym);
        const left = budget - spent;
        const mine = myGrants.filter((g) => g.member_id === p.id && g.ym === ym);
        const prevLeft = budgetOf(budgets, prev, p.id) - spentBy(p.id, prev);
        return (
          <div className={`grant-row ${left < 0 ? 'over' : ''}`} key={p.id}>
            <div className="grant-head">
              <b>{label(p)}</b>
              <button className="btn small-btn" onClick={() => { setAdding(adding === p.id ? null : p.id); setAmount(''); setNote(''); }}>+ دفعة</button>
            </div>
            <div className="grant-figures">
              <div><span className="muted small">الممنوح{admins > 1 ? ' (كل المديرين)' : ''}</span><strong className="num">{money(budget)}</strong></div>
              <div><span className="muted small">صُرف</span><strong className="num">{money(spent)}</strong></div>
              <div><span className="muted small">{left < 0 ? 'تجاوز' : 'المتبقي معه'}</span><strong className={`num ${left < 0 ? 'bad' : 'good'}`}>{money(Math.abs(left))}</strong></div>
            </div>

            {prevLeft > 0 && !row?.decided && (
              <div className="carry">
                <span className="small">متبقٍ من {ymLabel(prev)}: <b className="num">{money(prevLeft)}</b>. هل يُرحَّل إلى هذا الشهر؟</span>
                <div className="inline">
                  <button className="btn primary small-btn" onClick={() => run(() => api.carryOver(p.id, ym, true))}>ترحيل</button>
                  <button className="btn small-btn" onClick={() => run(() => api.carryOver(p.id, ym, false))}>لا يُرحَّل</button>
                </div>
              </div>
            )}
            {row && row.carried > 0 && <div className="muted small">منه مُرحَّل من {ymLabel(prev)}: <span className="num">{money(row.carried)}</span></div>}

            {mine.filter((g) => g.kind === 'grant').length > 0 && (
              <ul className="installments">
                {mine.filter((g) => g.kind === 'grant').map((g) => (
                  <li key={g.id}>
                    <span className="small">{g.created_at.slice(0, 10)}{g.note ? ` · ${g.note}` : ''}</span>
                    <span className="num">{moneyExact(g.amount)}</span>
                    <button className="link small" aria-label="حذف الدفعة" onClick={() => confirm('حذف هذه الدفعة؟') && run(() => api.deleteGrant(g.id))}>حذف</button>
                  </li>
                ))}
              </ul>
            )}

            {adding === p.id && (
              <form className="inline wrap" onSubmit={(e) => add(e, p.id)}>
                <input type="number" inputMode="decimal" min="0.01" step="0.01" required autoFocus placeholder="مبلغ الدفعة" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <input placeholder="ملاحظة (اختياري)" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn primary">منح</button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** مساحة المدير الخاصة: دخله هو، وجدول منح المصروف. لا تظهر إلا بعد فتح القفل. */
function PrivateIncome({ ym, spent, spentBy, sectionId }: { ym: string; spent: number; spentBy: (m: string, month: string) => number; sectionId: string }) {
  const { incomes, summary, myGrants, profiles, lockIncome } = useStore();
  const [asking, setAsking] = useState(false);

  if (incomes === null) {
    return (
      <section className="card section" id={sectionId}>
        <div className="section-head"><h2>🔒 دخلي ومنح المصروف (خاص بي)</h2></div>
        <p className="muted small">الدخل وجدول منح المصروف لا يظهران لأفراد الأسرة ولا للمديرين الآخرين. افتح القفل لعرضهما.</p>
        <button className="btn" onClick={() => setAsking(true)}>فتح المساحة الخاصة</button>
        {asking && <Modal title="فتح بيانات الدخل" onClose={() => setAsking(false)}><UnlockForm onDone={() => setAsking(false)} /></Modal>}
      </section>
    );
  }

  const income = incomes.filter((i) => i.received_on.startsWith(ym)).reduce((s, i) => s + i.amount, 0);
  const granted = myGrants.filter((g) => g.ym === ym && g.kind === 'grant').reduce((s, g) => s + g.amount, 0);
  const soleAdmin = profiles.filter((p) => p.role === 'admin').length === 1;
  const balance = balanceUpTo(monthTotals(summary, incomes), ym);

  return (
    <section className="card section" id={sectionId}>
      <div className="section-head"><h2>🔓 دخلي ومنح المصروف (خاص بي)</h2><button className="link" onClick={lockIncome}>قفل</button></div>
      <div className="facts">
        <div><span className="muted">دخلي في {ymLabel(ym)}</span><b className="num">{money(income)}</b></div>
        <div><span className="muted">ما منحته مصروفاً هذا الشهر</span><b className="num">{money(granted)}</b></div>
        <div><span className="muted">الباقي معي بعد المنح</span><b className={`num ${income - granted < 0 ? 'bad' : 'good'}`}>{money(income - granted)}</b></div>
        {soleAdmin && (
          <>
            <div><span className="muted">الدخل ناقص المصروف الفعلي للأسرة</span><b className={`num ${income - spent < 0 ? 'bad' : 'good'}`}>{money(income - spent)}</b></div>
            <div><span className="muted">الرصيد التراكمي حتى نهاية الشهر</span><b className={`num ${balance < 0 ? 'bad' : ''}`}>{money(balance)}</b></div>
          </>
        )}
      </div>
      {income === 0 && <p className="muted small">لم تسجّل دخلاً لهذا الشهر بعد. سجّله من تبويب «الدخل».</p>}
      <GrantsTable ym={ym} spentBy={spentBy} />
    </section>
  );
}

export default function Dashboard({ ym, setYm }: { ym: string; setYm: (ym: string) => void }) {
  const { summary, categories, beneficiaries, profiles, budgets, me, isAdmin } = useStore();

  const rows = useMemo(() => summary.filter((r) => r.ym === ym), [summary, ym]);
  const prevYm = shiftYm(ym, -1);
  const spent = rows.reduce((s, r) => s + r.total, 0);
  const prevSpent = summary.filter((r) => r.ym === prevYm).reduce((s, r) => s + r.total, 0);

  // ما سجّله كل عضو في كل شهر
  const spentMap = useMemo(() => groupSum(summary, (r) => `${r.ym}|${r.created_by}`), [summary]);
  const spentBy = (memberId: string, month: string) => spentMap.get(`${month}|${memberId}`) ?? 0;

  const approved = profiles.filter((p) => p.role !== 'pending');
  const members = approved.filter((p) => budgetOf(budgets, ym, p.id) > 0 || spentBy(p.id, ym) > 0);
  const budget = approved.reduce((s, p) => s + budgetOf(budgets, ym, p.id), 0);
  const remaining = budget - spent;
  const over = members.filter((p) => spentBy(p.id, ym) > budgetOf(budgets, ym, p.id));

  const isCurrent = ym === currentYm();
  const days = daysInMonth(ym);
  const dayNow = isCurrent ? Number(todayStr().slice(8)) : days;
  const dailyAvg = spent / dayNow;
  const daysLeft = days - dayNow + 1;

  const byCategory = sortedEntries(groupSum(rows, (r) => r.category_id));
  const byBeneficiary = sortedEntries(groupSum(rows, (r) => r.beneficiary_id));
  const budgetCats = categories.filter((c) => c.monthly_budget && c.active);
  const spentDelta = prevSpent > 0 ? ((spent - prevSpent) / prevSpent) * 100 : null;
  const privateId = 'private-income';

  return (
    <>
      <MonthNav ym={ym} setYm={setYm} />

      {/* تنبيه التجاوز: للمدير عن كل من تجاوز مصروفه، وللعضو عن نفسه */}
      {over.filter((p) => isAdmin || p.id === me.id).map((p) => {
        const by = spentBy(p.id, ym) - budgetOf(budgets, ym, p.id);
        return (
          <div className="alert" role="alert" key={p.id}>
            <span>
              ⚠ {p.id === me.id
                ? T(`تجاوزتَ مصروفك في ${ymLabel(ym)} بمبلغ `, `You've exceeded your allowance for ${ymLabel(ym)} by `)
                : T(`${label(p)} تجاوز مصروفه في ${ymLabel(ym)} بمبلغ `, `${label(p)} exceeded their allowance for ${ymLabel(ym)} by `)}<b className="num">{money(by)}</b>.{' '}
              {!isAdmin ? 'اطلب من مدير الأسرة دفعة مصروف جديدة.' : p.id === me.id ? 'خصّص لنفسك دفعة مصروف جديدة.' : 'خصّص له دفعة مصروف جديدة.'}
            </span>
            {isAdmin && <button className="btn small-btn" onClick={() => document.getElementById(privateId)?.scrollIntoView({ behavior: 'smooth' })}>منح مصروف</button>}
          </div>
        );
      })}

      <div className="tiles">
        <Tile
          label="ميزانية الأسرة هذا الشهر"
          value={budget > 0 ? money(budget) : '—'}
          hint={budget > 0 ? 'مجموع المصروف الممنوح' : isAdmin ? 'امنح المصروف من مساحتك الخاصة' : 'لم يمنح المدير مصروفاً بعد'}
        />
        <Tile
          label="مصروف الشهر"
          value={money(spent)}
          hint={spentDelta != null ? `${spentDelta >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(spentDelta))}% ${T('عن', 'vs')} ${ymLabel(prevYm)}` : undefined}
        />
        {budget > 0 && (
          <Tile
            label={remaining < 0 ? 'تجاوز الميزانية' : 'المتبقي من الميزانية'}
            value={money(Math.abs(remaining))}
            tone={remaining < 0 ? 'bad' : 'good'}
            hint={T(`صُرف ${Math.round((spent / budget) * 100)}% من الميزانية`, `${Math.round((spent / budget) * 100)}% of budget spent`)}
          />
        )}
        <Tile label="عدد العمليات" value={String(rows.reduce((s, r) => s + r.n, 0))} hint={T(`متوسط يومي ${money(dailyAvg)}`, `Daily average ${money(dailyAvg)}`)} />
      </div>

      {members.length > 0 && (
        <Section title="ميزانيات الأعضاء">
          <div className="member-budgets">
            {members.map((p) => (
              <MemberBudget key={p.id} name={label(p)} self={p.id === me.id} spent={spentBy(p.id, ym)} budget={budgetOf(budgets, ym, p.id)} />
            ))}
          </div>
          <p className="muted small">ميزانية العضو هي المصروف الممنوح له هذا الشهر، ويُحسب عليها ما يسجّله هو من مصروفات.</p>
        </Section>
      )}

      {isAdmin && <PrivateIncome ym={ym} spent={spent} spentBy={spentBy} sectionId={privateId} />}

      {isCurrent && (
        <Section title="معدل الصرف">
          <div className="facts">
            <div><span className="muted">متوسط الصرف اليومي</span><b className="num">{money(dailyAvg)}</b></div>
            <div><span className="muted">المتوقع حتى نهاية الشهر</span><b className="num">{money(dailyAvg * days)}</b></div>
            {budget > 0 && (
              <div>
                <span className="muted">المتاح يومياً للأيام الباقية ({daysLeft})</span>
                <b className="num">{remaining > 0 ? money(remaining / daysLeft) : '0'}</b>
              </div>
            )}
          </div>
        </Section>
      )}

      {budgetCats.length > 0 && (
        <Section title="ميزانيات البنود">
          <div className="hbars">
            {budgetCats.map((c) => (
              <Meter key={c.id} label={c.name} spent={byCategory.find(([id]) => id === c.id)?.[1] ?? 0} budget={c.monthly_budget!} />
            ))}
          </div>
        </Section>
      )}

      <Section title="المصروف حسب البند">
        <HBars rows={byCategory.map(([id, value]) => ({ label: nameOf(categories, id) || 'غير مصنف', value }))} />
      </Section>

      <Section title="المصروف حسب المستفيد">
        <HBars rows={byBeneficiary.map(([id, value]) => ({ label: nameOf(beneficiaries, id) || 'غير محدد', value }))} />
      </Section>
    </>
  );
}
