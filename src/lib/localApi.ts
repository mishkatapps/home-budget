// الوضع التجريبي: كل البيانات في ذاكرة المتصفح على هذا الجهاز فقط.
// يقرأ public/local/seed.json (ناتج scripts/export-access.ps1) إن وُجد.
import type {
  Api, AuditEntry, Beneficiary, BudgetRow, Category, Expense, Grant, Income, LegacyExport, Profile, SummaryRow,
} from './types';

const ADMIN: Profile = {
  id: 'local-admin', email: 'admin@local', full_name: 'مدير الأسرة (تجريبي)', avatar_url: null,
  role: 'admin', household_id: 'local', monthly_budget: null, created_at: new Date().toISOString(),
};

interface Db {
  profiles: Profile[];
  categories: Category[];
  beneficiaries: Beneficiary[];
  incomes: Income[];
  expenses: Expense[];
  audit: AuditEntry[];
  seq: number;
}

let dbPromise: Promise<Db> | null = null;
/** دفعات المصروف في الوضع التجريبي (مدير واحد): دفعات هذا الشهر، ومتبقٍ من الشهر السابق ينتظر قرار الترحيل */
const nowYm = new Date().toISOString().slice(0, 7);
const prevYm = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
const grants: Grant[] = [
  { id: 1, member_id: 'local-admin', ym: nowYm, amount: 3000, kind: 'grant', note: 'دفعة أول الشهر', created_at: new Date().toISOString() },
  { id: 2, member_id: 'local-member', ym: nowYm, amount: 1000, kind: 'grant', note: 'دفعة أول الشهر', created_at: new Date().toISOString() },
  { id: 3, member_id: 'local-member', ym: prevYm, amount: 1200, kind: 'grant', note: null, created_at: new Date().toISOString() },
];

function emptyDb(): Db {
  return {
    profiles: [
      ADMIN,
      { id: 'local-member', email: 'member@local', full_name: 'عضو تجريبي', avatar_url: null, role: 'member', household_id: 'local', monthly_budget: null, created_at: ADMIN.created_at },
      { id: 'local-pending', email: 'new@local', full_name: 'عضو ينتظر الموافقة', avatar_url: null, role: 'pending', household_id: 'local', monthly_budget: null, created_at: ADMIN.created_at },
    ],
    categories: [], beneficiaries: [], incomes: [], expenses: [], audit: [], seq: 1,
  };
}

function applyLegacy(db: Db, data: LegacyExport) {
  const now = new Date().toISOString();
  const catId = new Map(db.categories.map((c) => [c.name, c.id]));
  const benId = new Map(db.beneficiaries.map((b) => [b.name, b.id]));
  for (const name of data.categories) {
    if (!catId.has(name)) { const id = db.seq++; catId.set(name, id); db.categories.push({ id, name, active: true, monthly_budget: null }); }
  }
  for (const name of data.beneficiaries) {
    if (name && !benId.has(name)) { const id = db.seq++; benId.set(name, id); db.beneficiaries.push({ id, name, active: true }); }
  }
  for (const i of data.incomes) {
    db.incomes.push({ id: db.seq++, amount: i.amount, received_on: i.received_on, source: null, notes: null, created_by: null, created_at: now });
  }
  for (const e of data.expenses) {
    db.expenses.push({
      id: db.seq++, category_id: catId.get(e.category)!, amount: e.amount, paid_on: e.paid_on,
      beneficiary_id: benId.get(e.beneficiary) ?? null, notes: e.notes || null, created_by: null, receipt_path: null, created_at: now,
    });
  }
}

async function load(): Promise<Db> {
  const db = emptyDb();
  try {
    const res = await fetch('./local/seed.json');
    if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) applyLegacy(db, await res.json());
  } catch { /* لا يوجد ملف بيانات — نبدأ فارغين */ }
  if (!db.categories.length) {
    applyLegacy(db, {
      categories: ['طعام وشراب ونظافة', 'فواتير', 'مواصلات', 'ملابس', 'علاج وأدوية', 'تعليم'],
      beneficiaries: ['الأسرة'], incomes: [], expenses: [],
    });
  }
  return db;
}
const getDb = () => (dbPromise ??= load());

function log(db: Db, action: string, table: string, id: number | string | null, oldData: unknown, newData: unknown) {
  db.audit.unshift({
    id: db.seq++, at: new Date().toISOString(), user_id: ADMIN.id, user_name: ADMIN.full_name, action, table_name: table,
    record_id: id == null ? null : String(id), old_data: (oldData ?? null) as never, new_data: (newData ?? null) as never,
  });
}

function upsert<T extends { id: number }>(db: Db, table: string, list: T[], row: Partial<T> & { id?: number }, defaults: () => Omit<T, 'id'>) {
  if (row.id != null) {
    const i = list.findIndex((x) => x.id === row.id);
    const old = list[i];
    list[i] = { ...old, ...row } as T;
    log(db, 'update', table, row.id, old, list[i]);
  } else {
    const created = { ...defaults(), ...row, id: db.seq++ } as T;
    list.push(created);
    log(db, 'insert', table, created.id, null, created);
  }
}

function remove<T extends { id: number }>(db: Db, table: string, list: T[], id: number) {
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) { const [old] = list.splice(i, 1); log(db, 'delete', table, id, old, null); }
}

export const localApi: Api = {
  mode: 'local',
  async getProfile() { return (await getDb()).profiles[0]; },
  onAuthChange() { return () => {}; },
  async signIn() {},
  async signOut() {},

  async getHousehold() { return { id: 'local', name: 'أسرة تجريبية', invite_code: 'LOCAL12345' }; },
  async createHousehold() {},
  async signInAnonymously() {},
  async joinHousehold() {},
  async leaveHousehold() {},
  async deleteHousehold() { throw new Error('الحذف غير متاح في الوضع التجريبي.'); },
  async deleteAccount() { throw new Error('الحذف غير متاح في الوضع التجريبي.'); },

  async listProfiles() { return [...(await getDb()).profiles]; },
  async updateProfile(id, patch) {
    const db = await getDb();
    const i = db.profiles.findIndex((p) => p.id === id);
    const old = db.profiles[i];
    db.profiles[i] = { ...old, ...patch };
    log(db, 'update', 'profiles', id, old, db.profiles[i]);
  },

  async getBudgets() {
    const map = new Map<string, BudgetRow>();
    for (const g of grants) {
      const key = g.ym + '|' + g.member_id;
      const r = map.get(key) ?? { ym: g.ym, member_id: g.member_id, total: 0, carried: 0, decided: false };
      r.total += g.amount;
      if (g.kind === 'carryover') { r.carried += g.amount; r.decided = true; }
      map.set(key, r);
    }
    return [...map.values()];
  },
  async listMyGrants() { return [...grants]; },
  async addGrant(memberId, ym, amount, note) {
    const db = await getDb();
    const g: Grant = { id: db.seq++, member_id: memberId, ym, amount, kind: 'grant', note: note || null, created_at: new Date().toISOString() };
    grants.push(g);
    log(db, 'insert', 'allowance_grants', g.id, null, g);
  },
  async deleteGrant(id) {
    const i = grants.findIndex((g) => g.id === id);
    if (i >= 0) grants.splice(i, 1);
  },
  async carryOver(memberId, ym, approve) {
    const db = await getDb();
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const prev = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const budget = grants.filter((g) => g.member_id === memberId && g.ym === prev).reduce((s, g) => s + g.amount, 0);
    const spent = db.expenses.filter((e) => e.created_by === memberId && e.paid_on.startsWith(prev)).reduce((s, e) => s + e.amount, 0);
    grants.push({ id: db.seq++, member_id: memberId, ym, amount: approve ? Math.max(budget - spent, 0) : 0, kind: 'carryover', note: 'مُرحَّل من ' + prev, created_at: new Date().toISOString() });
  },
  async setMyAvatar(avatar) { const db = await getDb(); db.profiles[0] = { ...db.profiles[0], avatar: avatar || null }; },

  async listCategories() { return [...(await getDb()).categories]; },
  async saveCategory(c) { const db = await getDb(); upsert(db, 'categories', db.categories, c, () => ({ name: c.name, active: true, monthly_budget: null })); },
  async listBeneficiaries() { return [...(await getDb()).beneficiaries]; },
  async saveBeneficiary(b) { const db = await getDb(); upsert(db, 'beneficiaries', db.beneficiaries, b, () => ({ name: b.name, active: true })); },

  async listIncomes() { return [...(await getDb()).incomes]; },
  async saveIncome(i) {
    const db = await getDb();
    upsert(db, 'incomes', db.incomes, i, () => ({ ...i, created_by: ADMIN.id, created_at: new Date().toISOString() }));
  },
  async deleteIncome(id) { const db = await getDb(); remove(db, 'incomes', db.incomes, id); },

  async listExpenses(from, to) {
    const db = await getDb();
    return db.expenses.filter((e) => e.paid_on >= from && e.paid_on <= to).sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.id - a.id);
  },
  async saveExpense(e, receipt) {
    const db = await getDb();
    const extra = receipt ? { receipt_path: URL.createObjectURL(receipt) } : {};
    upsert<Expense>(db, 'expenses', db.expenses, { ...e, ...extra }, () => ({ ...e, created_by: ADMIN.id, receipt_path: null, created_at: new Date().toISOString(), ...extra }));
  },
  async deleteExpense(id) { const db = await getDb(); remove(db, 'expenses', db.expenses, id); },

  async getSummary() {
    const db = await getDb();
    const map = new Map<string, SummaryRow>();
    for (const e of db.expenses) {
      const ym = e.paid_on.slice(0, 7);
      const key = `${ym}|${e.category_id}|${e.beneficiary_id}|${e.created_by}`;
      const r = map.get(key);
      if (r) { r.total += e.amount; r.n++; }
      else map.set(key, { ym, category_id: e.category_id, beneficiary_id: e.beneficiary_id, created_by: e.created_by, total: e.amount, n: 1 });
    }
    return [...map.values()];
  },

  async listAudit(limit, offset) { return (await getDb()).audit.slice(offset, offset + limit); },
  async analyzeReceipt() {
    throw new Error('تحليل الفواتير يعمل بعد ربط التطبيق بـ Supabase و Gemini. في الوضع التجريبي تُحفظ الصورة فقط.');
  },
  async receiptUrl(path) { return path; },
  async importLegacy(data, onProgress) {
    const db = await getDb();
    applyLegacy(db, data);
    onProgress(data.expenses.length, data.expenses.length);
    log(db, 'import', 'legacy', null, null, { incomes: data.incomes.length, expenses: data.expenses.length });
    return { incomes: data.incomes.length, expenses: data.expenses.length };
  },
};
