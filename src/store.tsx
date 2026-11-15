import { createContext, useContext } from 'react';
import type { Beneficiary, Category, Household, Income, Profile, SummaryRow } from './lib/types';

export interface Store {
  me: Profile;
  household: Household | null;
  profiles: Profile[];
  categories: Category[];
  beneficiaries: Beneficiary[];
  incomes: Income[];
  summary: SummaryRow[];
  /** يتغير بعد كل إعادة تحميل — تستخدمه الصفحات لإعادة جلب قوائمها */
  version: number;
  isAdmin: boolean;
  canWrite: boolean;
  reload(): Promise<void>;
  /** ينفذ عملية كتابة ثم يعيد التحميل، ويعرض الخطأ إن فشلت */
  run(fn: () => Promise<void>): Promise<boolean>;
}

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreContext missing');
  return s;
}

export const nameOf = (list: { id: number | string; name?: string; full_name?: string | null }[], id: number | string | null) => {
  const x = list.find((i) => i.id === id);
  return x ? (x.name ?? x.full_name ?? '') : '';
};
