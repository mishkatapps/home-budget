import { useMemo, useState } from 'react';
import MonthlyChart from '../components/MonthlyChart';
import { HBars, Section, Tile } from '../components/ui';
import { currentYm, money, shiftYm, ymLabel } from '../lib/format';
import { groupSum, monthTotals, sortedEntries, type MonthTotals } from '../lib/stats';
import { nameOf, useStore } from '../store';

export default function Stats() {
  const { summary, incomes, categories, beneficiaries } = useStore();
  const totals = useMemo(() => monthTotals(summary, incomes), [summary, incomes]);
  const years = useMemo(() => [...new Set(totals.map((t) => t.ym.slice(0, 4)))].sort().reverse(), [totals]);
  const [period, setPeriod] = useState('last12');

  // شهور الفترة المختارة (بما فيها الشهور الخالية)
  const months = useMemo<MonthTotals[]>(() => {
    const first = period === 'last12' ? shiftYm(currentYm(), -11) : `${period}-01`;
    return Array.from({ length: 12 }, (_, i) => {
      const ym = shiftYm(first, i);
      return totals.find((t) => t.ym === ym) ?? { ym, income: 0, spent: 0 };
    });
  }, [period, totals]);

  const inPeriod = new Set(months.map((m) => m.ym));
  const rows = summary.filter((r) => inPeriod.has(r.ym));
  const income = months.reduce((s, m) => s + m.income, 0);
  const spent = months.reduce((s, m) => s + m.spent, 0);
  const active = months.filter((m) => m.spent > 0).length || 1;
  const top = months.reduce((a, b) => (b.spent > a.spent ? b : a), months[0]);

  const yearly = years.map((y) => {
    const ms = totals.filter((t) => t.ym.startsWith(y));
    return { y, income: ms.reduce((s, m) => s + m.income, 0), spent: ms.reduce((s, m) => s + m.spent, 0), n: ms.filter((m) => m.spent > 0).length || 1 };
  });

  return (
    <>
      <div className="toolbar">
        <label>
          الفترة
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="last12">آخر 12 شهراً</option>
            {years.map((y) => <option key={y} value={y}>سنة {y}</option>)}
          </select>
        </label>
      </div>

      <div className="tiles">
        <Tile label="إجمالي الدخل" value={money(income)} />
        <Tile label="إجمالي المصروف" value={money(spent)} hint={`متوسط شهري ${money(spent / active)}`} />
        <Tile
          label="الصافي (الادخار)"
          value={money(income - spent)}
          tone={income - spent < 0 ? 'bad' : 'good'}
          hint={income > 0 ? `${Math.round(((income - spent) / income) * 100)}% من الدخل` : undefined}
        />
        <Tile label="أعلى شهر صرفاً" value={money(top.spent)} hint={top.spent > 0 ? ymLabel(top.ym) : undefined} />
      </div>

      <Section title="الدخل والمصروف شهرياً">
        <MonthlyChart months={months} />
      </Section>

      <Section title="المصروف حسب البند">
        <HBars
          limit={10}
          rows={sortedEntries(groupSum(rows, (r) => r.category_id)).map(([id, value]) => ({
            label: nameOf(categories, id) || 'غير مصنف', value, note: `متوسط شهري ${money(value / active)}`,
          }))}
        />
      </Section>

      <Section title="المصروف حسب المستفيد">
        <HBars rows={sortedEntries(groupSum(rows, (r) => r.beneficiary_id)).map(([id, value]) => ({ label: nameOf(beneficiaries, id) || 'غير محدد', value }))} />
      </Section>

      <Section title="ملخص السنوات">
        <div className="table-wrap">
          <table>
            <thead><tr><th>السنة</th><th>الدخل</th><th>المصروف</th><th>الصافي</th><th>متوسط الصرف الشهري</th></tr></thead>
            <tbody>
              {yearly.map((r) => (
                <tr key={r.y}>
                  <td>{r.y}</td>
                  <td className="num">{money(r.income)}</td>
                  <td className="num">{money(r.spent)}</td>
                  <td className={`num ${r.income - r.spent < 0 ? 'bad' : ''}`}>{money(r.income - r.spent)}</td>
                  <td className="num">{money(r.spent / r.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
