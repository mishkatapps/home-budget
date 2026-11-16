-- ميزانية البيت — مخطط قاعدة البيانات على Supabase (متعدد الأسر)
-- شغّله من: Supabase Dashboard → SQL Editor → New query → Run
-- آمن لإعادة التشغيل ولا يحذف بيانات. إن كانت القاعدة تعمل بالمخطط القديم (أسرة واحدة)
-- فهو ينقل كل بياناتها إلى أسرة واحدة تلقائياً. أي خطأ يلغيa التنفيذ كله (معاملة واحدة).

begin;

-- ───────────── الجداول ─────────────
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'pending' check (role in ('admin', 'member', 'viewer', 'pending')),
  monthly_budget numeric(12, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  active boolean not null default true,
  monthly_budget numeric(12, 2)
);

create table if not exists public.beneficiaries (
  id bigint generated always as identity primary key,
  name text not null,
  active boolean not null default true
);

create table if not exists public.incomes (
  id bigint generated always as identity primary key,
  amount numeric(12, 2) not null,
  received_on date not null,
  source text,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  legacy_id integer
);

create table if not exists public.expenses (
  id bigint generated always as identity primary key,
  category_id bigint not null references public.categories (id),
  amount numeric(12, 2) not null,
  paid_on date not null default current_date,
  beneficiary_id bigint references public.beneficiaries (id),
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  receipt_path text,
  created_at timestamptz not null default now(),
  legacy_id integer
);
create index if not exists expenses_paid_on_idx on public.expenses (paid_on);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  user_name text,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb
);

-- عدّاد تحليل الفواتير (لحد يومي لكل أسرة)
create table if not exists public.receipt_scans (
  id bigint generated always as identity primary key,
  household_id uuid not null,
  user_id uuid,
  at timestamptz not null default now()
);
create index if not exists receipt_scans_idx on public.receipt_scans (household_id, at);

-- عمود الأسرة في كل جدول
alter table public.profiles add column if not exists household_id uuid references public.households (id) on delete set null;
alter table public.categories add column if not exists household_id uuid references public.households (id) on delete cascade;
alter table public.beneficiaries add column if not exists household_id uuid references public.households (id) on delete cascade;
alter table public.incomes add column if not exists household_id uuid references public.households (id) on delete cascade;
alter table public.expenses add column if not exists household_id uuid references public.households (id) on delete cascade;
alter table public.audit_log add column if not exists household_id uuid;
create index if not exists expenses_household_idx on public.expenses (household_id, paid_on);
create index if not exists audit_household_idx on public.audit_log (household_id, id);

-- ───────────── دوال الصلاحيات ─────────────
-- security definer حتى لا تدور سياسات profiles على نفسها
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.profiles where id = auth.uid()
$$;

-- ───────────── ترحيل قاعدة المخطط القديم (أسرة واحدة) ─────────────
do $$
declare h uuid;
begin
  if exists (select 1 from public.profiles where household_id is null and role in ('admin', 'member', 'viewer')) then
    perform set_config('app.skip_audit', 'on', true);
    insert into public.households (name, created_by)
      values ('أسرتنا', (select id from public.profiles where role = 'admin' order by created_at limit 1))
      returning id into h;
    update public.profiles set household_id = h where household_id is null;
    update public.categories set household_id = h where household_id is null;
    update public.beneficiaries set household_id = h where household_id is null;
    update public.incomes set household_id = h where household_id is null;
    update public.expenses set household_id = h where household_id is null;
    update public.audit_log set household_id = h where household_id is null;
    perform set_config('app.skip_audit', 'off', true);
  end if;
end $$;

alter table public.categories alter column household_id set default public.my_household(), alter column household_id set not null;
alter table public.beneficiaries alter column household_id set default public.my_household(), alter column household_id set not null;
alter table public.incomes alter column household_id set default public.my_household(), alter column household_id set not null;
alter table public.expenses alter column household_id set default public.my_household(), alter column household_id set not null;

-- الأسماء وأرقام أكسيس فريدة داخل الأسرة الواحدة لا على مستوى القاعدة
alter table public.categories drop constraint if exists categories_name_key;
alter table public.beneficiaries drop constraint if exists beneficiaries_name_key;
alter table public.incomes drop constraint if exists incomes_legacy_id_key;
alter table public.expenses drop constraint if exists expenses_legacy_id_key;
create unique index if not exists categories_household_name on public.categories (household_id, name);
create unique index if not exists beneficiaries_household_name on public.beneficiaries (household_id, name);
create unique index if not exists incomes_household_legacy on public.incomes (household_id, legacy_id);
create unique index if not exists expenses_household_legacy on public.expenses (household_id, legacy_id);

-- ───────────── المستخدم الجديد ─────────────
-- كل حساب جديد يبدأ بلا أسرة؛ ثم ينشئ أسرته (فيصير مديرها) أو ينضم برمز دعوة (فينتظر موافقة مديرها)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email),
    new.raw_user_meta_data ->> 'avatar_url',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  if public.my_household() is not null then raise exception 'أنت منضم إلى أسرة بالفعل'; end if;
  -- مدير الأسرة يحتاج حساباً دائماً يسترجعه من أي جهاز؛ المنضم بالرمز بلا حساب لا ينشئ أسرة
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'إنشاء أسرة يتطلب الدخول بحساب جوجل';
  end if;
  perform set_config('app.skip_audit', 'on', true);
  insert into public.households (name, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'أسرتي'), auth.uid()) returning id into h;
  update public.profiles set household_id = h, role = 'admin' where id = auth.uid();
  insert into public.categories (household_id, name)
    select h, x from unnest(array[
      'طعام وشراب ونظافة', 'مستلزمات منزلية وأجهزة', 'فواتير (كهرباء، غاز، مياه)', 'تليفون وإنترنت',
      'مواصلات وسيارة', 'علاج وأدوية', 'تعليم', 'ملابس', 'إيجار أو قسط', 'زكاة وصدقات', 'مجاملات وهدايا', 'ترفيه وخروجات', 'أخرى'
    ]) x;
  insert into public.beneficiaries (household_id, name) values (h, 'الأسرة');
  perform set_config('app.skip_audit', 'off', true);
  return h;
end $$;

-- أفراد الأسرة ينضمون بالرمز: بحساب جوجل، أو بلا حساب (دخول مجهول) مع كتابة الاسم
drop function if exists public.join_household(text);
create or replace function public.join_household(p_code text, p_name text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  h uuid;
  nm text := nullif(trim(coalesce(p_name, '')), '');
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  if public.my_household() is not null then raise exception 'أنت منضم إلى أسرة بالفعل'; end if;
  select id into h from public.households where invite_code = upper(trim(p_code));
  if h is null then raise exception 'رمز الدعوة غير صحيح'; end if;
  insert into public.profiles (id, role) values (auth.uid(), 'pending') on conflict (id) do nothing;
  if nm is null and (select coalesce(full_name, '') from public.profiles where id = auth.uid()) = '' then
    raise exception 'اكتب اسمك ليعرفك مدير الأسرة';
  end if;
  update public.profiles
    set household_id = h, role = 'pending', full_name = coalesce(left(nm, 60), full_name)
    where id = auth.uid();
end $$;

-- من لم يُعتمد بعد (أو أوقفه المدير) يستطيع الخروج لينشئ أسرته أو ينضم لأخرى
create or replace function public.leave_household() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set household_id = null where id = auth.uid() and role = 'pending';
end $$;

-- ───────────── سياسات الأمان (RLS) ─────────────
alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_log enable row level security;
alter table public.receipt_scans enable row level security; -- بلا سياسات: لا يصل إليه إلا الدوال

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.categories, public.beneficiaries, public.incomes, public.expenses to authenticated;
grant select, update on public.profiles, public.households to authenticated;
grant select on public.audit_log to authenticated;

do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('households', 'profiles', 'categories', 'beneficiaries', 'incomes', 'expenses', 'audit_log', 'receipt_scans')
  loop execute format('drop policy %I on public.%I', p.policyname, p.tablename); end loop;
end $$;

-- الأسرة: يراها أفرادها (والمنتظر يرى اسمها)، ويعدّلها مديرها
create policy households_read on public.households for select to authenticated using (id = public.my_household());
create policy households_admin_update on public.households for update to authenticated
  using (id = public.my_household() and public.my_role() = 'admin')
  with check (id = public.my_household() and public.my_role() = 'admin');

-- الأعضاء: كل معتمد يرى أفراد أسرته فقط، وغير المعتمد يرى نفسه. التعديل لمدير الأسرة وحده وداخل أسرته.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or (household_id = public.my_household() and public.my_role() in ('admin', 'member', 'viewer')));
create policy profiles_admin_update on public.profiles for update to authenticated
  using (household_id = public.my_household() and public.my_role() = 'admin')
  with check (household_id = public.my_household() and public.my_role() = 'admin');

-- البنود والمستفيدون والدخل: القراءة لأفراد الأسرة المعتمدين، والكتابة لمديرها
create policy categories_read on public.categories for select to authenticated
  using (household_id = public.my_household() and public.my_role() in ('admin', 'member', 'viewer'));
create policy categories_admin on public.categories for all to authenticated
  using (household_id = public.my_household() and public.my_role() = 'admin')
  with check (household_id = public.my_household() and public.my_role() = 'admin');
create policy beneficiaries_read on public.beneficiaries for select to authenticated
  using (household_id = public.my_household() and public.my_role() in ('admin', 'member', 'viewer'));
create policy beneficiaries_admin on public.beneficiaries for all to authenticated
  using (household_id = public.my_household() and public.my_role() = 'admin')
  with check (household_id = public.my_household() and public.my_role() = 'admin');
create policy incomes_read on public.incomes for select to authenticated
  using (household_id = public.my_household() and public.my_role() in ('admin', 'member', 'viewer'));
create policy incomes_admin on public.incomes for all to authenticated
  using (household_id = public.my_household() and public.my_role() = 'admin')
  with check (household_id = public.my_household() and public.my_role() = 'admin');

-- المصروفات: العضو يضيف باسمه ويعدّل/يحذف ما سجّله هو، والمدير يعدّل كل مصروفات أسرته
create policy expenses_read on public.expenses for select to authenticated
  using (household_id = public.my_household() and public.my_role() in ('admin', 'member', 'viewer'));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (household_id = public.my_household() and public.my_role() in ('admin', 'member') and created_by = auth.uid());
create policy expenses_update on public.expenses for update to authenticated
  using (household_id = public.my_household() and (public.my_role() = 'admin' or (public.my_role() = 'member' and created_by = auth.uid())))
  with check (household_id = public.my_household() and (public.my_role() = 'admin' or (public.my_role() = 'member' and created_by = auth.uid())));
create policy expenses_delete on public.expenses for delete to authenticated
  using (household_id = public.my_household() and (public.my_role() = 'admin' or (public.my_role() = 'member' and created_by = auth.uid())));

-- سجل العمليات: يقرؤه مدير الأسرة فقط، ولا يكتب فيه أحد مباشرة (الكتابة عبر المشغِّلات)
create policy audit_admin_read on public.audit_log for select to authenticated
  using (household_id = public.my_household() and public.my_role() = 'admin');

-- ───────────── سجل العمليات (تاريخ ووقت ومستخدم كل عملية) ─────────────
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uname text;
  o jsonb;
  n jsonb;
  r jsonb;
begin
  if coalesce(current_setting('app.skip_audit', true), '') = 'on' then return null; end if;
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  r := coalesce(n, o);
  -- حساب لم ينضم لأسرة بعد: لا يوجد سجل أسرة يُكتب فيه
  if coalesce(r ->> 'household_id', o ->> 'household_id') is null then return null; end if;
  select full_name into uname from public.profiles where id = auth.uid();
  insert into public.audit_log (household_id, user_id, user_name, action, table_name, record_id, old_data, new_data)
  values (coalesce((r ->> 'household_id')::uuid, (o ->> 'household_id')::uuid), auth.uid(), uname, lower(tg_op), tg_table_name, r ->> 'id', o, n);
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['profiles', 'categories', 'beneficiaries', 'incomes', 'expenses'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ───────────── الإحصاءات ─────────────
-- مجاميع مصروفات أسرة المستخدم لكل (شهر × بند × مستفيد × عضو) في استعلام واحد (RLS يحصرها في أسرته)
create or replace function public.get_summary() returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select to_char(paid_on, 'YYYY-MM') as ym, category_id, beneficiary_id, created_by,
           sum(amount)::float8 as total, count(*)::int as n
    from public.expenses
    group by 1, 2, 3, 4
  ) t
$$;

-- ───────────── استيراد بيانات أكسيس (لمدير الأسرة، إلى أسرته، بلا تكرار) ─────────────
create or replace function public.import_legacy(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  h uuid := public.my_household();
  ni int := 0;
  ne int := 0;
begin
  if h is null or public.my_role() is distinct from 'admin' then raise exception 'الاستيراد لمدير الأسرة فقط'; end if;
  perform set_config('app.skip_audit', 'on', true);

  insert into public.categories (household_id, name)
    select distinct h, x from jsonb_array_elements_text(coalesce(p -> 'categories', '[]'::jsonb)) x where x <> ''
    on conflict (household_id, name) do nothing;
  insert into public.beneficiaries (household_id, name)
    select distinct h, x from jsonb_array_elements_text(coalesce(p -> 'beneficiaries', '[]'::jsonb)) x where x <> ''
    on conflict (household_id, name) do nothing;

  insert into public.incomes (household_id, amount, received_on, legacy_id, created_by)
    select h, (x ->> 'amount')::numeric, (x ->> 'received_on')::date, (x ->> 'legacy_id')::int, null
    from jsonb_array_elements(coalesce(p -> 'incomes', '[]'::jsonb)) x
    on conflict (household_id, legacy_id) do nothing;
  get diagnostics ni = row_count;

  insert into public.expenses (household_id, category_id, amount, paid_on, beneficiary_id, notes, legacy_id, created_by)
    select h, c.id, (x ->> 'amount')::numeric, (x ->> 'paid_on')::date, b.id, nullif(x ->> 'notes', ''), (x ->> 'legacy_id')::int, null
    from jsonb_array_elements(coalesce(p -> 'expenses', '[]'::jsonb)) x
    join public.categories c on c.household_id = h and c.name = x ->> 'category'
    left join public.beneficiaries b on b.household_id = h and b.name = x ->> 'beneficiary'
    on conflict (household_id, legacy_id) do nothing;
  get diagnostics ne = row_count;

  perform set_config('app.skip_audit', 'off', true);
  if ni + ne > 0 then
    insert into public.audit_log (household_id, user_id, user_name, action, table_name, new_data)
    values (h, auth.uid(), (select full_name from public.profiles where id = auth.uid()), 'import', 'legacy',
            jsonb_build_object('incomes', ni, 'expenses', ne));
  end if;
  return jsonb_build_object('incomes', ni, 'expenses', ne);
end $$;

-- ───────────── حد يومي لتحليل الفواتير (30 فاتورة لكل أسرة في 24 ساعة) ─────────────
create or replace function public.claim_receipt_scan() returns boolean
language plpgsql security definer set search_path = public as $$
declare h uuid := public.my_household();
begin
  if h is null or public.my_role() not in ('admin', 'member') then return false; end if;
  if (select count(*) from public.receipt_scans where household_id = h and at > now() - interval '1 day') >= 30 then return false; end if;
  insert into public.receipt_scans (household_id, user_id) values (h, auth.uid());
  return true;
end $$;

-- ───────────── حذف الأسرة والحساب نهائياً ─────────────
-- (صور الفواتير يحذفها التطبيق عبر واجهة التخزين قبل استدعاء الدالة)
create or replace function public.delete_household() returns void
language plpgsql security definer set search_path = public as $$
declare h uuid := public.my_household();
begin
  if h is null or public.my_role() is distinct from 'admin' then raise exception 'حذف الأسرة لمديرها فقط'; end if;
  perform set_config('app.skip_audit', 'on', true);
  update public.profiles set role = 'pending', monthly_budget = null where household_id = h;
  delete from public.households where id = h; -- يحذف معها البنود والمستفيدين والدخل والمصروفات، ويُخرج الأعضاء منها
  delete from public.audit_log where household_id = h;
  delete from public.receipt_scans where household_id = h;
  perform set_config('app.skip_audit', 'off', true);
end $$;

create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  h uuid := public.my_household();
  r text := public.my_role();
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  -- المدير الوحيد لأسرة فيها أعضاء آخرون لا يتركها بلا مدير
  if h is not null and r = 'admin'
     and not exists (select 1 from public.profiles where household_id = h and role = 'admin' and id <> auth.uid()) then
    if exists (select 1 from public.profiles where household_id = h and id <> auth.uid() and role <> 'pending') then
      raise exception 'أنت المدير الوحيد. عيّن مديراً آخر أو احذف الأسرة أولاً';
    end if;
    perform public.delete_household(); -- أسرة لا أحد فيها غيره تُحذف مع حسابه
  end if;
  perform set_config('app.skip_audit', 'on', true);
  delete from auth.users where id = auth.uid(); -- يحذف ملفه في profiles، وما سجّله يبقى لأسرته بلا اسم
  perform set_config('app.skip_audit', 'off', true);
end $$;

revoke execute on function
  public.import_legacy(jsonb), public.get_summary(), public.my_role(), public.my_household(),
  public.create_household(text), public.join_household(text, text), public.leave_household(), public.claim_receipt_scan(),
  public.delete_household(), public.delete_account()
  from anon, public;
grant execute on function
  public.import_legacy(jsonb), public.get_summary(), public.my_role(), public.my_household(),
  public.create_household(text), public.join_household(text, text), public.leave_household(), public.claim_receipt_scan(),
  public.delete_household(), public.delete_account()
  to authenticated;

-- ───────────── تخزين صور الفواتير (خاص، مجلد لكل أسرة) ─────────────
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;

drop policy if exists receipts_read on storage.objects;
drop policy if exists receipts_insert on storage.objects;
drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.my_household()::text
         and public.my_role() = 'admin');
create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.my_household()::text
         and public.my_role() in ('admin', 'member', 'viewer'));
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.my_household()::text
              and public.my_role() in ('admin', 'member'));

commit;
