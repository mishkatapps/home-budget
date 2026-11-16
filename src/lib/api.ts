import { localApi } from './localApi';
import { createSupabaseApi } from './supabaseApi';
import type { Api } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** بدون إعدادات Supabase يعمل التطبيق في الوضع التجريبي المحلي */
const demo = new URLSearchParams(window.location.search).has('demo'); // ‎?demo يفتح الوضع التجريبي للمعاينة
export const api: Api = url && key && !demo ? createSupabaseApi(url, key) : localApi;
/** استيراد ملف بيانات قديم (أكسيس): للنسخة الخاصة والوضع التجريبي فقط */
export const importEnabled = api.mode === 'local' || import.meta.env.VITE_ENABLE_IMPORT === 'true';
export const appleEnabled = import.meta.env.VITE_ENABLE_APPLE === 'true';
