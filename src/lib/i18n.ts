// اللغة: العربية هي الأصل، والإنجليزية باختيار المستخدم (كما في موقع مشكاة وروض الذكر).
// - المفتاح mk-lang هو نفسه في موقع مشكاة، فمن اختار الإنجليزية هناك يفتح التطبيق بالإنجليزية.
// - النصوص الثابتة تُترجم من القاموس (en.ts) على الشاشة مباشرة؛ والجمل التي فيها أرقام أو أسماء تُكتب باللغتين في الكود بـ T().
// - بيانات المستخدم (البنود، الملاحظات، الأسماء) لا تُترجم.
import { EN_PATTERNS, EN_UI } from './en';

export type Lang = 'ar' | 'en';
const KEY = 'mk-lang';

function detect(): Lang {
  const q = /[?&]lang=(ar|en)\b/.exec(location.search);
  let l: string | null = null;
  try { l = q?.[1] ?? localStorage.getItem(KEY); if (q) localStorage.setItem(KEY, q[1]); } catch { l = q?.[1] ?? null; }
  return l === 'en' ? 'en' : 'ar';
}

export const LANG: Lang = detect();
export const EN = LANG === 'en';
/** نص باللغتين: يُستخدم للجمل التي فيها قيم متغيرة */
export const T = (ar: string, en: string) => (EN ? en : ar);

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* تخزين محجوب */ }
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  url.hash = ''; // بقايا «#» بعد الدخول بجوجل تجعل الانتقال قفزة داخل الصفحة بلا إعادة تحميل
  const next = url.toString().replace(/#$/, '');
  if (next === location.href.replace(/#.*$/, '')) location.reload();
  else location.replace(next);
}

const ARABIC = /[؀-ۿ]/;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
// يفصل الرموز والأرقام في طرفي النص عن الجملة العربية نفسها
const SPLIT = /^([^؀-ۿ]*?)([؀-ۿ][\s\S]*[؀-ۿ»)؟!.…])([^؀-ۿ]*)$/;

function lookup(core: string): string | null {
  if (EN_UI[core] != null) return EN_UI[core];
  const bare = core.replace(/[.:،؟!]+$/, '');
  if (bare !== core && EN_UI[bare] != null) return EN_UI[bare] + core.slice(bare.length).replace('،', ',').replace('؟', '?');
  for (const [re, fn] of EN_PATTERNS) {
    const m = core.match(re);
    if (m) return typeof fn === 'function' ? fn(...m) : fn;
  }
  return null;
}

/** يترجم نصاً عربياً من القاموس إن وُجد، وإلا يعيده كما هو */
export function tr(s: string): string {
  if (!EN || !s || !ARABIC.test(s)) return s;
  const n = norm(s);
  const whole = lookup(n);
  if (whole != null) return s.match(/^\s*/)![0] + whole + s.match(/\s*$/)![0];
  const m = n.match(SPLIT);
  if (!m) return s;
  const hit = lookup(m[2]);
  return hit == null ? s : s.match(/^\s*/)![0] + m[1] + hit + m[3] + s.match(/\s*$/)![0];
}

// لا نترجم ما يكتبه المستخدم: حقول الإدخال، وأي عنصر عليه data-noi18n
const SKIP = 'input,textarea,script,style,[data-noi18n],[contenteditable="true"]';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

function translateNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const p = node.parentElement;
    if (!p || p.closest(SKIP)) return;
    const v = node.nodeValue ?? '';
    if (ARABIC.test(v)) { const t = tr(v); if (t !== v) node.nodeValue = t; }
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (el.matches('script,style,[data-noi18n]')) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && ARABIC.test(v)) { const t = tr(v); if (t !== v) el.setAttribute(a, t); }
  }
  if (el.matches('input,textarea')) return;
  el.childNodes.forEach(translateNode);
}

/** يُستدعى مرة عند بدء التطبيق: يضبط اتجاه الصفحة، ويترجم الواجهة إن كانت اللغة الإنجليزية */
export function startI18n() {
  const html = document.documentElement;
  html.lang = LANG;
  html.dir = EN ? 'ltr' : 'rtl';
  document.title = T('ميزانية البيت', 'Home Budget');
  if (!EN) return;
  const confirm0 = window.confirm.bind(window), alert0 = window.alert.bind(window);
  window.confirm = (m?: string) => confirm0(tr(String(m ?? '')));
  window.alert = (m?: unknown) => alert0(tr(String(m ?? '')));
  translateNode(document.body);
  new MutationObserver((list) => {
    for (const r of list) {
      if (r.type === 'characterData') translateNode(r.target);
      else if (r.type === 'attributes') translateNode(r.target);
      else r.addedNodes.forEach(translateNode);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
