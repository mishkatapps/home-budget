// المظهر: تلقائي (يتبع الجهاز)، نهاري، أو ليلي. الاختيار يُحفظ على هذا الجهاز.
export type ThemePref = 'auto' | 'light' | 'dark';
const KEY = 'theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; }
}

/** التلقائي: ليلي إن كان الجهاز على الوضع الداكن، أو كان الوقت ليلاً (من 6 مساءً إلى 6 صباحاً) */
function autoTheme(): 'light' | 'dark' {
  const hour = new Date().getHours();
  return media.matches || hour >= 18 || hour < 6 ? 'dark' : 'light';
}

function apply() {
  const pref = getThemePref();
  document.documentElement.dataset.theme = pref === 'auto' ? autoTheme() : pref;
}

export function setThemePref(pref: ThemePref) {
  try { if (pref === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref); } catch { /* تخزين محجوب: يبقى للجلسة فقط */ }
  apply();
}

/** يُستدعى مرة عند بدء التطبيق */
export function initTheme() {
  apply();
  media.addEventListener('change', apply);
  // يتبدل وحده عند حلول المساء أو الصباح، وعند العودة للتطبيق
  setInterval(apply, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
}
