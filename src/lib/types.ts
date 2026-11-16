export type Role = 'admin' | 'member' | 'viewer' | 'pending';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  /** الأسرة التي ينتمي إليها؛ null لحساب جديد لم ينشئ أسرة ولم ينضم لواحدة */
  household_id: string | null;
  /** الميزانية الشهرية المخصصة للعضو من إجمالي الدخل */
  monthly_budget: number | null;
  created_at: string;
  /** للمستخدم الحالي فقط: انضم بالرمز بلا حساب جوجل، فهويته محفوظة في هذا المتصفح وحده */
  anonymous?: boolean;
}

export interface Household {
  id: string;
  name: string;
  /** رمز يشاركه المدير مع أفراد أسرته لينضموا */
  invite_code: string;
}

export interface Category {
  id: number;
  name: string;
  active: boolean;
  monthly_budget: number | null;
}

export interface Beneficiary {
  id: number;
  name: string;
  active: boolean;
}

export interface Income {
  id: number;
  amount: number;
  received_on: string; // yyyy-mm-dd
  source: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Expense {
  id: number;
  category_id: number;
  amount: number;
  paid_on: string; // yyyy-mm-dd
  beneficiary_id: number | null;
  notes: string | null;
  created_by: string | null;
  receipt_path: string | null;
  created_at: string;
}

/** مجموع المصروفات لكل (شهر × بند × مستفيد × عضو مُسجِّل) */
export interface SummaryRow {
  ym: string; // yyyy-mm
  category_id: number;
  beneficiary_id: number | null;
  created_by: string | null;
  total: number;
  n: number;
}

export interface AuditEntry {
  id: number;
  at: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export interface ReceiptResult {
  merchant: string | null;
  date: string | null;
  total: number | null;
  items: { name: string; price: number | null }[];
  category: string | null;
}

export interface LegacyExport {
  categories: string[];
  beneficiaries: string[];
  incomes: { legacy_id: number; amount: number; received_on: string }[];
  expenses: {
    legacy_id: number;
    category: string;
    amount: number;
    paid_on: string;
    beneficiary: string;
    notes: string;
  }[];
}

export type ExpenseInput = Omit<Expense, 'id' | 'created_at' | 'created_by' | 'receipt_path'> & { id?: number };
export type IncomeInput = Omit<Income, 'id' | 'created_at' | 'created_by'> & { id?: number };

export interface Api {
  mode: 'local' | 'cloud';
  getProfile(): Promise<Profile | null>;
  onAuthChange(cb: () => void): () => void;
  signIn(provider: 'google' | 'apple'): Promise<void>;
  signOut(): Promise<void>;

  getHousehold(): Promise<Household | null>;
  createHousehold(name: string): Promise<void>;
  /** دخول بلا حساب لفرد الأسرة الذي سينضم برمز الدعوة */
  signInAnonymously(): Promise<void>;
  joinHousehold(code: string, name?: string): Promise<void>;
  /** لمن لم يُعتمد بعد: يسحب طلب الانضمام */
  leaveHousehold(): Promise<void>;
  /** للمدير: يحذف الأسرة وكل بياناتها وصور فواتيرها نهائياً */
  deleteHousehold(): Promise<void>;
  /** يحذف حساب المستخدم نهائياً (ومعه أسرته إن لم يكن فيها غيره) */
  deleteAccount(): Promise<void>;

  listProfiles(): Promise<Profile[]>;
  updateProfile(id: string, patch: Partial<Pick<Profile, 'role' | 'monthly_budget'>>): Promise<void>;

  listCategories(): Promise<Category[]>;
  saveCategory(c: Partial<Category> & { name: string }): Promise<void>;
  listBeneficiaries(): Promise<Beneficiary[]>;
  saveBeneficiary(b: Partial<Beneficiary> & { name: string }): Promise<void>;

  listIncomes(): Promise<Income[]>;
  saveIncome(i: IncomeInput): Promise<void>;
  deleteIncome(id: number): Promise<void>;

  listExpenses(from: string, to: string): Promise<Expense[]>;
  saveExpense(e: ExpenseInput, receipt?: Blob | null): Promise<void>;
  deleteExpense(id: number): Promise<void>;
  getSummary(): Promise<SummaryRow[]>;

  listAudit(limit: number, offset: number): Promise<AuditEntry[]>;
  analyzeReceipt(image: Blob, categories: string[]): Promise<ReceiptResult>;
  receiptUrl(path: string): Promise<string | null>;
  importLegacy(data: LegacyExport, onProgress: (done: number, total: number) => void): Promise<{ incomes: number; expenses: number }>;
}
