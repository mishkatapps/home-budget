import type { Income, SummaryRow } from './types';

export interface MonthTotals {
  ym: string;
  income: number;
  spent: number;
}

/** إجمالي الدخل والمصروف لكل شهر، مرتبة تصاعدياً */
export function monthTotals(summary: SummaryRow[], incomes: Income[]): MonthTotals[] {
  const map = new Map<string, MonthTotals>();
  const get = (ym: string) => {
    let t = map.get(ym);
    if (!t) map.set(ym, (t = { ym, income: 0, spent: 0 }));
    return t;
  };
  for (const r of summary) get(r.ym).spent += r.total;
  for (const i of incomes) get(i.received_on.slice(0, 7)).income += i.amount;
  return [...map.values()].sort((a, b) => a.ym.localeCompare(b.ym));
}

/** الرصيد التراكمي (كل الدخل − كل المصروف) حتى نهاية الشهر المحدد */
export function balanceUpTo(totals: MonthTotals[], ym: string): number {
  let b = 0;
  for (const t of totals) if (t.ym <= ym) b += t.income - t.spent;
  return b;
}

export function groupSum<K>(rows: SummaryRow[], key: (r: SummaryRow) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + r.total);
  return m;
}

export function sortedEntries<K>(m: Map<K, number>): [K, number][] {
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
