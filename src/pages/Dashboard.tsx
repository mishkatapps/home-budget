import { useMemo, useState } from 'react';
import { UnlockForm } from '../components/IncomeLock';
import { HBars, MemberBudget, Meter, Modal, MonthNav, Section, Tile } from '../components/ui';
import { currentYm, daysInMonth, money, shiftYm, todayStr, ymLabel } from '../lib/format';
import { balanceUpTo, groupSum, monthTotals, sortedEntries } from '../lib/stats';
import { allowanceOf, nameOf, useStore } from '../store';

/** قسم خاص بالمدير: دخله هو، وما منحه، وما بقي معه. لا يظهر إلا بعد فتح القفل. */
function PrivateIncome({ ym, spent }: { ym: string; spent: number }) {
  const { incomes, summary, myGrants, profiles, lockIncome } = useStore();
  const [asking, setAsking] = useState(false);

  if (incomes === null) {
    return (
      <Section title="🔒 دخلي (خاص بي)">
        <p className="muted small">الدخل لا يظهر لأفراد الأسرة ولا للمديرين الآخرين. افتح القفل لعرضه.</p>
        <button className="btn" onClick={() => setAsking(true)}>فتح بيانات الدخل</button>
        {asking && <Modal title="فتح بيانات الدخل" onClose={() => setAsking(false)}><UnlockForm onDone={() => setAsking(false)} /></Modal>}
      </Section>
    );
  }

  const income = incomes.filter((i) => i.received_on.startsWith(ym)).reduce((s, i) => s + i.amount, 0);
  const granted = myGrants.reduce((s, g) => s + g.amount, 0);
  const soleAdmin = profiles.filter((p) => p.role === 'admin').length === 1;
  const totals = monthTotals(summary, incomes);
  const balance = balanceUpTo(totals, ym);

  return (
    <Section title="🔓 دخلي (خاص بي)" action={<button className="link" onClick={lockIncome}>قفل</button>}>
      <div className="facts">
        <div><span className="muted">دخلي في {ymLabel(ym)}</span><b className="num">{money(income)}</b></div>
        <div><span className="muted">ما منحته مصروفاً شهرياً</span><b className="num">{money(granted)}</b></div>
        <div><span className="muted">الباقي معي بعد المنح</span><b className={`num ${income - granted < 0 ? 'bad' : 'good'}`}>{money(income - granted)}</b></div>
        {soleAdmin && (
          <>
            <div><span className="muted">الدخل ناقص المصروف الفعلي للأسرة</span><b className={`num ${income - spent < 0 ? 'bad' : 'good'}`}>{money(income - spent)}</b></div>
            <div><span className="muted">الرصيد التراكمي حتى نهاية الشهر</span><b className={`num ${balance < 0 ? 'bad' : ''}`}>{money(balance)}</b></div>
          </>
        )}
      </div>
      {income === 0 && <p className="muted small">لم تسجّل دخلاً لهذا الشهر بعد. سجّله من تبويب «الدخل».</p>}
    </Section>
  );
}

export default function Dashboard({ ym, setYm }: { ym: string; setYm: (ym: string) => void }) {
  const { summary, categories, beneficiaries, profiles, allowances, me, isAdmin } = useStore();

  const rows = useMemo(() => summary.filter((r) => r.ym === ym), [summary, ym]);
  const prevYm = shiftYm(ym, -1);
  const spent = rows.reduce((s, r) => s + r.total, 0);
  const prevSpent = summary.filter((r) => r.ym === prevYm).reduce((s, r) => s + r.total, 0);

  const members = profiles.filter((p) => p.role !== 'pending' && allowanceOf(allowances, p.id) > 0);
  const budget = members.reduce((s, p) => s + allowanceOf(allowances, p.id), 0);
  const remaining = budget - spent;

  const isCurrent = ym === currentYm();
  const days = daysInMonth(ym);
  const dayNow = isCurrent ? Number(todayStr().slice(8)) : days;
  const dailyAvg = spent / dayNow;
  const daysLeft = days - dayNow + 1;

  const byCategory = sortedEntries(groupSum(rows, (r) => r.category_id));
  const byBeneficiary = sortedEntries(groupSum(rows, (r) => r.beneficiary_id));
  const byMember = groupSum(rows, (r) => r.created_by);
  const budgetCats = categories.filter((c) => c.monthly_budget && c.active);
  const spentDelta = prevSpent > 0 ? ((spent - prevSpent) / prevSpent) * 100 : null;

  return (
    <>
      <MonthNav ym={ym} setYm={setYm} />

      <div className="tiles">
        <Tile
          label="ميزانية الأسرة الشهرية"
          value={budget > 0 ? money(budget) : '—'}
          hint={budget > 0 ? `مصروف ${members.length} ${members.length === 1 ? 'عضو' : 'أعضاء'}` : isAdmin ? 'حدّد المصروف من «الإدارة»' : 'لم يحددها المدير بعد'}
        />
        <Tile
          label="مصروف الشهر"
          value={money(spent)}
          hint={spentDelta != null ? `${spentDelta >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(spentDelta))}% عن ${ymLabel(prevYm)}` : undefined}
        />
        {budget > 0 && (
          <Tile
            label={remaining < 0 ? 'تجاوز الميزانية' : 'المتبقي من الميزانية'}
            value={money(Math.abs(remaining))}
            tone={remaining < 0 ? 'bad' : 'good'}
            hint={`صُرف ${Math.round((spent / budget) * 100)}% من الميزانية`}
          />
        )}
        <Tile label="عدد العمليات" value={String(rows.reduce((s, r) => s + r.n, 0))} hint={`متوسط يومي ${money(dailyAvg)}`} />
      </div>

      {members.length > 0 && (
        <Section title="ميزانيات الأعضاء">
          <div className="member-budgets">
            {members.map((p) => (
              <MemberBudget key={p.id} name={p.full_name ?? p.email ?? ''} self={p.id === me.id} spent={byMember.get(p.id) ?? 0} budget={allowanceOf(allowances, p.id)} />
            ))}
          </div>
          <p className="muted small">ميزانية العضو هي المصروف الشهري الممنوح له، ويُحسب عليها ما يسجّله هو من مصروفات.</p>
        </Section>
      )}

      {isAdmin && <PrivateIncome ym={ym} spent={spent} />}

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
