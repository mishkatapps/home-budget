import { createContext, useContext } from 'react';
import type { AllowanceTotal, Beneficiary, Category, Grant, Household, Income, Profile, SummaryRow } from './lib/types';

export interface Store {
  me: Profile;
  household: Household | null;
  profiles: Profile[];
  categories: Category[];
  beneficiaries: Beneficiary[];
  /** دخل المدير الحالي؛ null ما دام قفل الدخل مغلقاً (لا يُجلب من الخادم قبل الفتح) */
  incomes: Income[] | null;
  summary: SummaryRow[];
  /** ميزانية كل عضو = مجموع ما منحه له المديرون؛ تظهر لكل الأسرة */
  allowances: AllowanceTotal[];
  /** ما منحه المدير الحالي نفسه */
  myGrants: Grant[];
  /** يتغير بعد كل إعادة تحميل — تستخدمه الصفحات لإعادة جلب قوائمها */
  version: number;
  isAdmin: boolean;
  canWrite: boolean;
  reload(): Promise<void>;
  /** ينفذ عملية كتابة ثم يعيد التحميل، ويعرض الخطأ إن فشلت */
  run(fn: () => Promise<void>): Promise<boolean>;
  /** يجلب دخل المدير بعد نجاح التحقق (بصمة/وجه/PIN) */
  unlockIncome(): Promise<void>;
  lockIncome(): void;
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

export const allowanceOf = (list: AllowanceTotal[], memberId: string) => list.find((a) => a.member_id === memberId)?.total ?? 0;
