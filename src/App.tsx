import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, appleEnabled } from './lib/api';
import { currentYm, daysLabel } from './lib/format';
import type { BudgetRow, Beneficiary, Category, Grant, Household, Income, Profile, SummaryRow } from './lib/types';
import { licenseOf, StoreContext, type Store } from './store';
import { MishkatCredit } from './components/Brand';
import Scene, { Backdrop, type SceneName } from './components/Scene';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Incomes from './pages/Incomes';
import Stats from './pages/Stats';
import Admin from './pages/Admin';
import { Onboarding, Pending } from './pages/Onboarding';

type Tab = SceneName;
const TABS: { id: Tab; label: string; icon: string; adminOnly?: boolean }[] = [
  { id: 'home', label: 'الرئيسية', icon: 'M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'expenses', label: 'المصروفات', icon: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM8 8h8M8 12h8' },
  { id: 'incomes', label: 'الدخل', icon: 'M12 3v14m0 0-5-5m5 5 5-5M4 21h16', adminOnly: true },
  { id: 'stats', label: 'الإحصاءات', icon: 'M4 20V10m6 10V4m6 16v-7m4 7H2' },
  { id: 'admin', label: 'الإدارة', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0' },
];
/** يُقفل الدخل تلقائياً إن غاب التطبيق عن الشاشة أكثر من دقيقتين */
const AUTO_LOCK_MS = 2 * 60 * 1000;

interface Data {
  household: Household | null;
  profiles: Profile[];
  categories: Category[];
  beneficiaries: Beneficiary[];
  summary: SummaryRow[];
  budgets: BudgetRow[];
  myGrants: Grant[];
  pinSet: boolean;
}

export default function App() {
  const [me, setMe] = useState<Profile | null | undefined>(undefined);
  const [data, setData] = useState<Data | null>(null);
  const [incomes, setIncomes] = useState<Income[] | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [ym, setYm] = useState(currentYm());
  const unlocked = useRef(false);

  const loadProfile = useCallback(async () => {
    try { setMe(await api.getProfile()); } catch (e) { setError((e as Error).message); setMe(null); }
  }, []);

  useEffect(() => {
    loadProfile();
    return api.onAuthChange(loadProfile);
  }, [loadProfile]);

  const approved = !!me && !!me.household_id && me.role !== 'pending';

  const reload = useCallback(async () => {
    const [household, profiles, categories, beneficiaries, summary, budgets, myGrants, pinSet] = await Promise.all([
      api.getHousehold(), api.listProfiles(), api.listCategories(), api.listBeneficiaries(), api.getSummary(),
      api.getBudgets(), api.listMyGrants(), api.hasMyPin(),
    ]);
    setData({ household, profiles, categories, beneficiaries, summary, budgets, myGrants, pinSet });
    if (unlocked.current) setIncomes(await api.listIncomes());
    setVersion((v) => v + 1);
  }, []);

  const lockIncome = useCallback(() => { unlocked.current = false; setIncomes(null); }, []);

  useEffect(() => {
    if (approved) reload().catch((e) => setError((e as Error).message));
    else lockIncome();
  }, [approved, reload, lockIncome]);

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS) lockIncome();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [lockIncome]);

  const store = useMemo<Store | null>(() => {
    if (!me || !data) return null;
    const self = { ...(data.profiles.find((p) => p.id === me.id) ?? me), anonymous: me.anonymous };
    const license = licenseOf(data.household);
    return {
      me: self, ...data, incomes, version, reload, lockIncome,
      isAdmin: self.role === 'admin',
      license,
      canWrite: (self.role === 'admin' || self.role === 'member') && !license.expired,
      async run(fn) {
        try { await fn(); await reload(); return true; }
        catch (e) { setError((e as Error).message); return false; }
      },
      async unlockIncome() {
        unlocked.current = true;
        try { setIncomes(await api.listIncomes()); }
        catch (e) { unlocked.current = false; setError((e as Error).message); }
      },
    };
  }, [me, data, incomes, version, reload, lockIncome]);

  if (me === undefined) return <div className="center muted">جارٍ التحميل…</div>;

  if (me === null) {
    return (
      <div className="center">
        <div className="login card">
          <img src="./icon.svg" alt="" width={72} height={72} />
          <h1>ميزانية البيت</h1>
          <MishkatCredit />
          <p className="muted">سجّل الدخل والمصروفات وتابع ميزانية الأسرة</p>
          {error && <p className="error">{error}</p>}
          <button className="btn primary block" onClick={() => api.signIn('google').catch((e) => setError(e.message))}>الدخول بحساب جوجل</button>
          <p className="muted small">لمدير الأسرة، ولمن يريد حساباً يفتحه من أي جهاز.</p>
          {api.mode === 'cloud' && (
            <>
              <div className="divider muted small">أو</div>
              <button className="btn block" onClick={() => api.signInAnonymously().catch((e) => setError(e.message))}>الانضمام إلى أسرة برمز دعوة</button>
              <p className="muted small">لأفراد الأسرة بلا حساب: عضو جديد برمز الدعوة، أو عودة عضو سابق برمزه الشخصي.</p>
            </>
          )}
          {appleEnabled && (
            <button className="btn block" onClick={() => api.signIn('apple').catch((e) => setError(e.message))}>الدخول بحساب آبل</button>
          )}
          <a className="muted small" href="./privacy.html">سياسة الخصوصية</a>
        </div>
      </div>
    );
  }

  if (!me.household_id) return <Onboarding me={me} onDone={loadProfile} />;
  if (me.role === 'pending') return <Pending me={me} onRefresh={loadProfile} />;

  if (!store) return <div className="center muted">{error ?? 'جارٍ تحميل البيانات…'}</div>;

  const tabs = TABS.filter((t) => !t.adminOnly || store.isAdmin);
  const current = tabs.some((t) => t.id === tab) ? tab : 'home';

  return (
    <StoreContext.Provider value={store}>
      <Backdrop name={current} />
      <div className="app">
        <header className="hero">
          <Scene name={current} />
          <div className="hero-text">
            <strong>ميزانية البيت{store.household ? ` · ${store.household.name}` : ''}</strong>
            <span className="small">{store.me.full_name}</span>
          </div>
        </header>
        {api.mode === 'local' && (
          <div className="banner">وضع تجريبي: البيانات على هذا الجهاز فقط، والتعديلات تزول عند إعادة تحميل الصفحة.</div>
        )}
        {store.me.anonymous && !store.pinSet && (
          <div className="banner danger" role="alert">
            لم تضبط رمزك الشخصي بعد. بدونه لا تستطيع العودة إن خرجت من هذا المتصفح.{' '}
            <button className="link" onClick={() => setTab('admin')}>اضبطه الآن</button>
          </div>
        )}
        {store.license.expired && (
          <div className="banner danger" role="alert">
            انتهى الشهر المجاني. بياناتك محفوظة وتظهر للعرض، والتسجيل والتعديل متوقفان حتى التفعيل.{' '}
            <button className="link" onClick={() => setTab('admin')}>{store.isAdmin ? 'تفعيل الآن' : 'التفاصيل'}</button>
          </div>
        )}
        {!store.license.expired && !store.license.licensed && store.license.daysLeft <= 7 && (
          <div className="banner">
            باقي {daysLabel(store.license.daysLeft)} من الشهر المجاني.{' '}
            <button className="link" onClick={() => setTab('admin')}>التفاصيل</button>
          </div>
        )}
        {error && (
          <div className="banner danger" role="alert">
            {error} <button className="link" onClick={() => setError(null)}>إغلاق</button>
          </div>
        )}
        <main>
          {current === 'home' && <Dashboard ym={ym} setYm={setYm} />}
          {current === 'expenses' && <Expenses ym={ym} setYm={setYm} />}
          {current === 'incomes' && <Incomes />}
          {current === 'stats' && <Stats />}
          {current === 'admin' && <Admin />}
        </main>
        <nav className="tabs">
          {tabs.map((t) => (
            <button key={t.id} className={current === t.id ? 'active' : ''} onClick={() => setTab(t.id)} aria-current={current === t.id}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
              <span>{t.id === 'admin' && !store.isAdmin ? 'حسابي' : t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </StoreContext.Provider>
  );
}
