// تصدير البيانات واستيرادها: نسخة احتياطية مشفّرة بكلمة سر (تُحفظ في Google Drive أو أي مكان)، وملفات Excel.
// التشفير يتم على الجهاز قبل أن يغادره الملف: AES-GCM بمفتاح مشتق من كلمة السر (PBKDF2).
// من لا يعرف كلمة السر لا يستطيع قراءة النسخة، ولا نحن؛ وإن نُسيت كلمة السر فلا سبيل لاسترجاعها.
import { api } from './api';
import type { Beneficiary, Category, Income, LegacyExport } from './types';

const MAGIC = 'mishkat-home-budget-backup';
const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = new Uint8Array(buf as ArrayBuffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFrom(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 250_000 },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

/** معرّف ثابت للصف حتى لا يتكرر إن استُورد الملف نفسه مرتين (53 بتاً من محتوى الصف وترتيب تكراره) */
function rowKey(parts: (string | number)[], occurrence: number): number {
  const text = parts.join('\u0001') + '\u0001' + occurrence;
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) + 0x9e3779b9;
  }
  return 10_000_000_000 + (h1 >>> 12) * 4294967296 + (h2 >>> 0); // أقل من 2^53
}

/** يجمع بيانات الأسرة بصيغة الاستيراد. الدخل يُضمَّن فقط إن كان قفله مفتوحاً (incomes ليس null). */
export async function collect(categories: Category[], beneficiaries: Beneficiary[], incomes: Income[] | null): Promise<LegacyExport> {
  const expenses = await api.listExpenses('0001-01-01', '9999-12-31');
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const ben = new Map(beneficiaries.map((b) => [b.id, b.name]));
  return {
    categories: categories.map((c) => c.name),
    beneficiaries: beneficiaries.map((b) => b.name),
    // السالب = رقم الصف الأصلي: يمنع تكراره إن استُرجعت النسخة في الأسرة نفسها والصف ما زال موجوداً
    incomes: (incomes ?? []).map((i) => ({ legacy_id: -i.id, amount: i.amount, received_on: i.received_on, source: i.source ?? '', notes: i.notes ?? '' })),
    expenses: expenses.map((e) => ({
      legacy_id: -e.id, category: cat.get(e.category_id) ?? 'غير مصنف', amount: e.amount, paid_on: e.paid_on,
      beneficiary: e.beneficiary_id == null ? '' : (ben.get(e.beneficiary_id) ?? ''), notes: e.notes ?? '',
    })),
  };
}

export async function encryptBackup(data: LegacyExport, password: string, householdName: string): Promise<Blob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(password, salt), new TextEncoder().encode(JSON.stringify(data)));
  const envelope = {
    format: MAGIC, version: 1, created_at: new Date().toISOString(), household: householdName,
    counts: { expenses: data.expenses.length, incomes: data.incomes.length },
    kdf: 'PBKDF2-SHA256-250000', cipher: 'AES-256-GCM', salt: b64(salt), iv: b64(iv), data: b64(cipher),
  };
  return new Blob([JSON.stringify(envelope)], { type: 'application/octet-stream' });
}

export async function decryptBackup(file: File, password: string): Promise<LegacyExport> {
  let env: { format?: string; salt: string; iv: string; data: string };
  try { env = JSON.parse(await file.text()); } catch { throw new Error('الملف ليس نسخة احتياطية من ميزانية البيت.'); }
  if (env.format !== MAGIC) throw new Error('الملف ليس نسخة احتياطية من ميزانية البيت.');
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) as BufferSource }, await keyFrom(password, unb64(env.salt)), unb64(env.data) as BufferSource);
    return JSON.parse(new TextDecoder().decode(plain)) as LegacyExport;
  } catch { throw new Error('كلمة السر غير صحيحة، أو الملف تالف.'); }
}

/** على الهاتف يفتح قائمة المشاركة (ومنها Google Drive)؛ على الحاسب ينزّل الملف */
export async function saveOrShare(blob: Blob, fileName: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], fileName, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: fileName }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') throw new Error('أُلغيت المشاركة.'); /* غير مدعوم لهذا النوع: ننزّل */ }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

// ───── Excel ─────
const EXPENSE_HEAD = ['التاريخ', 'البند', 'المبلغ', 'المستفيد', 'ملاحظات'];
const INCOME_HEAD = ['التاريخ', 'المبلغ', 'المصدر', 'ملاحظات'];
const SHEET_EXPENSES = 'المصروفات', SHEET_INCOMES = 'الدخل', SHEET_HELP = 'تعليمات';
const head = (titles: string[]) => titles.map((value) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#D9B15C' }));
const dateCell = (ymd: string) => ({ value: new Date(ymd + 'T00:00:00Z'), type: Date, format: 'yyyy-mm-dd' });

/** ملف Excel بورقتين (المصروفات، الدخل) بنفس أعمدة قالب الاستيراد؛ بلا data = قالب فارغ بأمثلة */
export async function excelFile(data: LegacyExport | null, categories: string[]): Promise<Blob> {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const today = new Date().toISOString().slice(0, 10);
  const expenses = data
    ? data.expenses.map((e) => [dateCell(e.paid_on), e.category, e.amount, e.beneficiary, e.notes])
    : [[dateCell(today), categories[0] ?? 'طعام وشراب ونظافة', 250, 'الأسرة', 'مثال: احذف هذا الصف واكتب بياناتك']];
  const incomes = data
    ? data.incomes.map((i) => [dateCell(i.received_on), i.amount, i.source ?? '', i.notes ?? ''])
    : [[dateCell(today), 8000, 'الراتب', 'مثال: احذف هذا الصف']];
  const help = [
    ['طريقة تعبئة القالب'],
    ['1) اكتب كل مصروف في صف في ورقة «المصروفات»، وكل دخل في صف في ورقة «الدخل». لا تغيّر صف العناوين.'],
    ['2) التاريخ بصيغة سنة-شهر-يوم مثل 2026-11-16. المبلغ رقم فقط بلا عملة.'],
    ['3) البند: اكتبه كما في التطبيق. البند الجديد يُضاف تلقائياً عند الاستيراد.'],
    ['4) المستفيد والملاحظات اختياريان.'],
    ['5) في التطبيق: الإدارة ← النسخ الاحتياطي والاستيراد ← استيراد من Excel.'],
    ['استيراد الملف نفسه مرتين لا يكرر صفوفه.'],
    [''],
    ['البنود الموجودة الآن:'],
    ...categories.map((c) => [c]),
  ];
  const sheet = { stickyRowsCount: 1, rightToLeft: true };
  return writeExcelFile([
    { data: [head(EXPENSE_HEAD), ...expenses], sheet: SHEET_EXPENSES, columns: [{ width: 14 }, { width: 30 }, { width: 12 }, { width: 16 }, { width: 44 }], ...sheet },
    { data: [head(INCOME_HEAD), ...incomes], sheet: SHEET_INCOMES, columns: [{ width: 14 }, { width: 12 }, { width: 22 }, { width: 44 }], ...sheet },
    { data: help, sheet: SHEET_HELP, columns: [{ width: 100 }], rightToLeft: true },
  ] as never).toBlob();
}

/** تاريخ من خلية Excel: كائن تاريخ، أو نص سنة-شهر-يوم أو يوم/شهر/سنة، أو الرقم التسلسلي لإكسل */
function toYmd(v: unknown): string | null {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) return toYmd(new Date(Math.round((v - 25569) * 86400_000)));
  if (typeof v === 'string') {
    const s = v.trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  return null;
}
const toAmount = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[,،\s]/g, ''));
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const text = (v: unknown) => (v == null ? '' : String(v).trim());

export interface ExcelImport { data: LegacyExport; skipped: string[] }

/** يقرأ ملف Excel بصيغة القالب. الصفوف الناقصة تُتخطى ويُذكر سببها. */
export async function readExcel(file: File): Promise<ExcelImport> {
  const { default: readExcelFile } = await import('read-excel-file/browser');
  let sheets: { sheet: string; data: unknown[][] }[];
  try { sheets = (await readExcelFile(file)) as never; } catch { throw new Error('تعذرت قراءة الملف. تأكد أنه ملف Excel بصيغة ‎.xlsx'); }
  const find = (name: string, index: number) => sheets.find((s) => s.sheet.trim() === name) ?? sheets[index];
  const skipped: string[] = [];
  const seen = new Map<string, number>();
  const key = (parts: (string | number)[]) => {
    const k = parts.join('\u0001');
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return rowKey(parts, n);
  };
  const data: LegacyExport = { categories: [], beneficiaries: [], incomes: [], expenses: [] };

  const exp = find(SHEET_EXPENSES, 0);
  (exp?.data ?? []).slice(1).forEach((r, i) => {
    if (!r || r.every((c) => text(c) === '')) return;
    const paid_on = toYmd(r[0]), category = text(r[1]), amount = toAmount(r[2]);
    if (!paid_on || !category || amount == null) { skipped.push(`المصروفات، الصف ${i + 2}: ${!paid_on ? 'تاريخ غير مفهوم' : !category ? 'بلا بند' : 'مبلغ غير صحيح'}`); return; }
    const beneficiary = text(r[3]), notes = text(r[4]);
    if (!data.categories.includes(category)) data.categories.push(category);
    if (beneficiary && !data.beneficiaries.includes(beneficiary)) data.beneficiaries.push(beneficiary);
    data.expenses.push({ legacy_id: key(['E', paid_on, category, amount, beneficiary, notes]), category, amount, paid_on, beneficiary, notes });
  });

  const inc = sheets.find((s) => s.sheet.trim() === SHEET_INCOMES);
  (inc?.data ?? []).slice(1).forEach((r, i) => {
    if (!r || r.every((c) => text(c) === '')) return;
    const received_on = toYmd(r[0]), amount = toAmount(r[1]);
    if (!received_on || amount == null) { skipped.push(`الدخل، الصف ${i + 2}: ${!received_on ? 'تاريخ غير مفهوم' : 'مبلغ غير صحيح'}`); return; }
    const source = text(r[2]), notes = text(r[3]);
    data.incomes.push({ legacy_id: key(['I', received_on, amount, source, notes]), amount, received_on, source, notes });
  });
  return { data, skipped };
}
