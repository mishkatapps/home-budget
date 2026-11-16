// المظهر: تلقائي (يتبع الجهاز)، نهاري، أو ليلي. الاختيار يُحفظ على هذا الجهاز.
export type ThemePref = 'auto' | 'light' | 'dark';
const KEY = 'theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; }
}

function apply() {
  const pref = getThemePref();
  document.documentElement.dataset.theme = pref === 'auto' ? (media.matches ? 'dark' : 'light') : pref;
}

export function setThemePref(pref: ThemePref) {
  try { if (pref === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref); } catch { /* تخزين محجوب: يبقى للجلسة فقط */ }
  document.documentElement.dataset.theme = pref === 'auto' ? (media.matches ? 'dark' : 'light') : pref;
}

/** يُستدعى مرة عند بدء التطبيق */
export function initTheme() {
  apply();
  media.addEventListener('change', apply);
}
