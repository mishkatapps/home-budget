import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, appleEnabled } from './lib/api';
import { currentYm } from './lib/format';
import type { Beneficiary, Category, Household, Income, Profile, SummaryRow } from './lib/types';
import { Onboarding, Pending } from './pages/Onboarding';
import { StoreContext, type Store } from './store';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Incomes from './pages/Incomes';
import Stats from './pages/Stats';
import Admin from './pages/Admin';

type Tab = 'home' | 'expenses' | 'incomes' | 'stats' | 'admin';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'الرئيسية', icon: 'M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'expenses', label: 'المصروفات', icon: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM8 8h8M8 12h8' },
  { id: 'incomes', label: 'الدخل', icon: 'M12 3v14m0 0-5-5m5 5 5-5M4 21h16' },
  { id: 'stats', label: 'الإحصاءات', icon: 'M4 20V10m6 10V4m6 16v-7m4 7H2' },
  { id: 'admin', label: 'الإدارة', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0' },
];

interface Data {
  household: Household | null;
  profiles: Profile[];
  categories: Category[];
  beneficiaries: Beneficiary[];
  incomes: Income[];
  summary: SummaryRow[];
}

export default function App() {
  const [me, setMe] = useState<Profile | null | undefined>(undefined);
  const [data, setData] = useState<Data | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [ym, setYm] = useState(currentYm());

  const loadProfile = useCallback(async () => {
    try { setMe(await api.getProfile()); } catch (e) { setError((e as Error).message); setMe(null); }
  }, []);

  useEffect(() => {
    loadProfile();
    return api.onAuthChange(loadProfile);
  }, [loadProfile]);

  const approved = !!me && !!me.household_id && me.role !== 'pending';

  const reload = useCallback(async () => {
    const [household, profiles, categories, beneficiaries, incomes, summary] = await Promise.all([
      api.getHousehold(), api.listProfiles(), api.listCategories(), api.listBeneficiaries(), api.listIncomes(), api.getSummary(),
    ]);
    setData({ household, profiles, categories, beneficiaries, incomes, summary });
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (approved) reload().catch((e) => setError((e as Error).message));
  }, [approved, reload]);

  const store = useMemo<Store | null>(() => {
    if (!me || !data) return null;
    const self = data.profiles.find((p) => p.id === me.id) ?? me;
    return {
      me: self, ...data, version, reload,
      isAdmin: self.role === 'admin',
      canWrite: self.role === 'admin' || self.role === 'member',
      async run(fn) {
        try { await fn(); await reload(); return true; }
        catch (e) { setError((e as Error).message); return false; }
      },
    };
  }, [me, data, version, reload]);

  if (me === undefined) return <div className="center muted">جارٍ التحميل…</div>;

  if (me === null) {
    return (
      <div className="center">
        <div className="login card">
          <img src="./icon.svg" alt="" width={72} height={72} />
          <h1>ميزانية البيت</h1>
          <p className="muted">سجّل الدخل والمصروفات وتابع ميزانية الأسرة</p>
          {error && <p className="error">{error}</p>}
          <button className="btn primary block" onClick={() => api.signIn('google').catch((e) => setError(e.message))}>الدخول بحساب جوجل</button>
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

  return (
    <StoreContext.Provider value={store}>
      <div className="app">
        <header className="topbar">
          <strong>ميزانية البيت{store.household ? ` · ${store.household.name}` : ''}</strong>
          <span className="muted small">{store.me.full_name}</span>
        </header>
        {api.mode === 'local' && (
          <div className="banner">وضع تجريبي: البيانات على هذا الجهاز فقط، والتعديلات تزول عند إعادة تحميل الصفحة.</div>
        )}
        {error && (
          <div className="banner danger" role="alert">
            {error} <button className="link" onClick={() => setError(null)}>إغلاق</button>
          </div>
        )}
        <main>
          {tab === 'home' && <Dashboard ym={ym} setYm={setYm} />}
          {tab === 'expenses' && <Expenses ym={ym} setYm={setYm} />}
          {tab === 'incomes' && <Incomes />}
          {tab === 'stats' && <Stats />}
          {tab === 'admin' && <Admin />}
        </main>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
              <span>{t.id === 'admin' && !store.isAdmin ? 'حسابي' : t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </StoreContext.Provider>
  );
}
