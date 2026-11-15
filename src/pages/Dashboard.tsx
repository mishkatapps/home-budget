import { useMemo } from 'react';
import { HBars, Meter, MonthNav, Section, Tile } from '../components/ui';
import { currentYm, daysInMonth, money, shiftYm, todayStr, ymLabel } from '../lib/format';
import { balanceUpTo, groupSum, monthTotals, sortedEntries } from '../lib/stats';
import { nameOf, useStore } from '../store';

export default function Dashboard({ ym, setYm }: { ym: string; setYm: (ym: string) => void }) {
  const { summary, incomes, categories, beneficiaries, profiles } = useStore();

  const totals = useMemo(() => monthTotals(summary, incomes), [summary, incomes]);
  const rows = useMemo(() => summary.filter((r) => r.ym === ym), [summary, ym]);

  const cur = totals.find((t) => t.ym === ym) ?? { ym, income: 0, spent: 0 };
  const prev = totals.find((t) => t.ym === shiftYm(ym, -1));
  const remaining = cur.income - cur.spent;
  const balance = balanceUpTo(totals, ym);
  const carried = balance - remaining; // المُرحّل من الشهور السابقة

  const isCurrent = ym === currentYm();
  const days = daysInMonth(ym);
  const dayNow = isCurrent ? Number(todayStr().slice(8)) : days;
  const dailyAvg = cur.spent / dayNow;
  const daysLeft = days - dayNow + 1;

  const byCategory = sortedEntries(groupSum(rows, (r) => r.category_id));
  const byBeneficiary = sortedEntries(groupSum(rows, (r) => r.beneficiary_id));
  const byMember = groupSum(rows, (r) => r.created_by);

  const budgetCats = categories.filter((c) => c.monthly_budget && c.active);
  const budgetMembers = profiles.filter((p) => p.monthly_budget && p.role !== 'pending');
  const allocated = budgetMembers.reduce((s, p) => s + (p.monthly_budget ?? 0), 0);
  const spentDelta = prev && prev.spent > 0 ? ((cur.spent - prev.spent) / prev.spent) * 100 : null;

  return (
    <>
      <MonthNav ym={ym} setYm={setYm} />

      <div className="tiles">
        <Tile label="دخل الشهر" value={money(cur.income)} hint={cur.income === 0 ? 'لم يُسجَّل دخل بعد' : undefined} />
        <Tile
          label="مصروف الشهر"
          value={money(cur.spent)}
          hint={spentDelta != null ? `${spentDelta >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(spentDelta))}% عن ${ymLabel(prev!.ym)}` : undefined}
        />
        <Tile
          label="المتبقي من دخل الشهر"
          value={money(remaining)}
          tone={remaining < 0 ? 'bad' : 'good'}
          hint={cur.income > 0 ? `صُرف ${Math.round((cur.spent / cur.income) * 100)}% من الدخل` : undefined}
        />
        <Tile label="الرصيد التراكمي" value={money(balance)} tone={balance < 0 ? 'bad' : undefined} hint={`منه مُرحّل من قبل: ${money(carried)}`} />
      </div>

      <Section title={isCurrent ? 'معدل الصرف' : 'معدل الصرف في الشهر'}>
        <div className="facts">
          <div><span className="muted">متوسط الصرف اليومي</span><b className="num">{money(dailyAvg)}</b></div>
          {isCurrent && (
            <>
              <div><span className="muted">المتوقع حتى نهاية الشهر</span><b className="num">{money(dailyAvg * days)}</b></div>
              <div>
                <span className="muted">المتاح يومياً للأيام الباقية ({daysLeft})</span>
                <b className="num">{remaining > 0 ? money(remaining / daysLeft) : '0'}</b>
              </div>
            </>
          )}
          <div><span className="muted">عدد العمليات</span><b className="num">{rows.reduce((s, r) => s + r.n, 0)}</b></div>
        </div>
      </Section>

      {budgetMembers.length > 0 && (
        <Section title="ميزانيات الأعضاء">
          <div className="hbars">
            {budgetMembers.map((p) => (
              <Meter key={p.id} label={p.full_name ?? p.email ?? ''} spent={byMember.get(p.id) ?? 0} budget={p.monthly_budget!} />
            ))}
          </div>
          {cur.income > 0 && (
            <p className="muted small">
              إجمالي المخصص للأعضاء {money(allocated)} ({Math.round((allocated / cur.income) * 100)}% من دخل الشهر)، والباقي للمصروف العام {money(cur.income - allocated)}.
            </p>
          )}
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
