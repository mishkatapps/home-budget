// تفضيلات شكل التطبيق لكل مستخدم على جهازه: حجم الخط ونوعه، الخلفية، ولوحة الألوان.
// تُطبَّق كخصائص data-* على <html> وتقرؤها styles.css.

export const FONT_SIZES = [['s', 'صغير'], ['m', 'متوسط'], ['l', 'كبير'], ['xl', 'أكبر']] as const;
export const FONT_FAMILIES = [['sans', 'عادي'], ['naskh', 'نسخ'], ['tahoma', 'تاهوما']] as const;
export const BACKGROUNDS = [['scenes', 'مشاهد مرسومة'], ['soft', 'ألوان هادئة'], ['none', 'بلا خلفية']] as const;
export const PALETTES = [['mishkat', 'مشكاة'], ['blue', 'أزرق'], ['green', 'أخضر زيتي']] as const;

const DEFAULTS = { fs: 'm', font: 'sans', bg: 'scenes', palette: 'mishkat' };
export type PrefKey = keyof typeof DEFAULTS;

export function getPref(key: PrefKey): string {
  try { return localStorage.getItem(`pref:${key}`) ?? DEFAULTS[key]; } catch { return DEFAULTS[key]; }
}

export function setPref(key: PrefKey, value: string) {
  try { localStorage.setItem(`pref:${key}`, value); } catch { /* تخزين محجوب: يبقى للجلسة فقط */ }
  document.documentElement.dataset[key] = value;
}

/** يُستدعى مرة عند بدء التطبيق */
export function initPrefs() {
  for (const key of Object.keys(DEFAULTS) as PrefKey[]) document.documentElement.dataset[key] = getPref(key);
}
