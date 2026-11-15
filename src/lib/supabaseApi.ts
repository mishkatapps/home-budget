import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Api, AuditEntry, Beneficiary, Category, Expense, Household, Income, Profile, ReceiptResult, SummaryRow } from './types';

const PAGE = 1000; // الحد الأقصى للصفوف في الطلب الواحد لدى Supabase

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey);

  async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const rows = check(await build(from, from + PAGE - 1)) ?? [];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  async function upsertRow(table: string, row: { id?: number | string }) {
    const { id, ...rest } = row;
    if (id != null) check(await sb.from(table).update(rest).eq('id', id));
    else check(await sb.from(table).insert(rest));
  }

  return {
    mode: 'cloud',

    async getProfile() {
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      const profile = check(await sb.from('profiles').select('*').eq('id', user.id).maybeSingle()) as Profile | null;
      // قاعدة ما زالت على المخطط القديم (أسرة واحدة، بلا عمود household_id): تعمل كما كانت
      if (profile && !('household_id' in profile)) (profile as Profile).household_id = 'legacy';
      return profile ?? {
        id: user.id, email: user.email ?? null, full_name: user.email ?? null, avatar_url: null,
        role: 'pending', household_id: null, monthly_budget: null, created_at: new Date().toISOString(),
      };
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(cb, 0);
      });
      return () => data.subscription.unsubscribe();
    },
    async signIn(provider) {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) throw new Error(error.message);
    },
    async signOut() { await sb.auth.signOut(); },

    // RLS يحصر النتيجة في أسرة المستخدم
    async getHousehold() {
      const { data, error } = await sb.from('households').select('id,name,invite_code').maybeSingle();
      return error ? null : (data as Household | null); // الخطأ هنا يعني مخططاً قديماً بلا جدول أسر
    },
    async createHousehold(name) { check(await sb.rpc('create_household', { p_name: name })); },
    async joinHousehold(code) { check(await sb.rpc('join_household', { p_code: code })); },
    async leaveHousehold() { check(await sb.rpc('leave_household')); },

    async listProfiles() { return check(await sb.from('profiles').select('*').order('created_at')) as Profile[]; },
    async updateProfile(id, patch) { check(await sb.from('profiles').update(patch).eq('id', id)); },

    async listCategories() { return check(await sb.from('categories').select('*').order('id')) as Category[]; },
    async saveCategory(c) { await upsertRow('categories', c); },
    async listBeneficiaries() { return check(await sb.from('beneficiaries').select('*').order('id')) as Beneficiary[]; },
    async saveBeneficiary(b) { await upsertRow('beneficiaries', b); },

    async listIncomes() {
      return fetchAll<Income>((a, b) => sb.from('incomes').select('id,amount,received_on,source,notes,created_by,created_at').order('received_on').order('id').range(a, b));
    },
    async saveIncome(i) { await upsertRow('incomes', i); },
    async deleteIncome(id) { check(await sb.from('incomes').delete().eq('id', id)); },

    async listExpenses(from, to) {
      return fetchAll<Expense>((a, b) =>
        sb.from('expenses').select('id,category_id,amount,paid_on,beneficiary_id,notes,created_by,receipt_path,created_at')
          .gte('paid_on', from).lte('paid_on', to).order('paid_on', { ascending: false }).order('id', { ascending: false }).range(a, b));
    },
    async saveExpense(e, receipt) {
      const row: Record<string, unknown> = { ...e };
      if (receipt) {
        const { data } = await sb.auth.getUser();
        const household = check(await sb.rpc('my_household')) as string;
        const path = `${household}/${data.user?.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        check(await sb.storage.from('receipts').upload(path, receipt, { contentType: 'image/jpeg' }));
        row.receipt_path = path;
      }
      await upsertRow('expenses', row);
    },
    async deleteExpense(id) { check(await sb.from('expenses').delete().eq('id', id)); },
    async getSummary() { return (check(await sb.rpc('get_summary')) ?? []) as SummaryRow[]; },

    async listAudit(limit, offset) {
      return check(await sb.from('audit_log').select('*').order('id', { ascending: false }).range(offset, offset + limit - 1)) as AuditEntry[];
    },

    async analyzeReceipt(image, categories) {
      const { data, error } = await sb.functions.invoke('analyze-receipt', {
        body: { image: await blobToBase64(image), mime: image.type || 'image/jpeg', categories },
      });
      if (error) throw new Error('تعذر تحليل الفاتورة: ' + error.message);
      if (data?.error) throw new Error(data.error);
      return data as ReceiptResult;
    },
    async receiptUrl(path) {
      const { data } = await sb.storage.from('receipts').createSignedUrl(path, 600);
      return data?.signedUrl ?? null;
    },

    async importLegacy(data, onProgress) {
      const result = { incomes: 0, expenses: 0 };
      const head = check(await sb.rpc('import_legacy', {
        p: { categories: data.categories, beneficiaries: data.beneficiaries, incomes: data.incomes, expenses: [] },
      })) as { incomes: number; expenses: number };
      result.incomes += head.incomes;
      for (let i = 0; i < data.expenses.length; i += PAGE) {
        const r = check(await sb.rpc('import_legacy', { p: { expenses: data.expenses.slice(i, i + PAGE) } })) as { incomes: number; expenses: number };
        result.expenses += r.expenses;
        onProgress(Math.min(i + PAGE, data.expenses.length), data.expenses.length);
      }
      return result;
    },
  };
}
