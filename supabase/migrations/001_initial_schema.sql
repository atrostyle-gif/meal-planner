-- ============================================================
-- meal-planner: 家族共有の初期スキーマ
-- Supabase SQL Editor でこのファイル全体を実行してください。
--
-- 依存順序（要約）:
-- 1. extension / enum
-- 2. テーブル（profiles → households → members → invites → 共有データ）
-- 3. index
-- 4. updated_at 関数・trigger
-- 5. household_members を参照するヘルパー
-- 6. RPC（家庭作成・招待）
-- 7. RLS 有効化 → policy → grant
-- ============================================================

-- ------------------------------------------------------------
-- 1. extension / enum
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";

do $$ begin
  create type public.household_role as enum ('owner', 'member');
exception
  when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 2. テーブル（外部キーの参照先を先に作成）
-- ------------------------------------------------------------

-- 2.1 profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 2.2 households
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 2.3 household_members（households の後）
create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (household_id, user_id),
  unique (user_id) -- 1ユーザー1家庭（初期方針）
);

-- 2.4 household_invites
create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users (id),
  expires_at timestamptz not null,
  used_by uuid references auth.users (id),
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

-- 2.5 recipes
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  category text not null,
  course text not null,
  servings integer not null default 4 check (servings >= 1),
  cooking_time_minutes integer,
  tags jsonb not null default '[]'::jsonb,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  notes text,
  is_sample boolean not null default false,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 2.6 meal_plans（週単位献立）
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start date not null,
  days jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, week_start)
);

-- 2.7 shopping_lists
create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start date not null,
  items jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, week_start)
);

-- 2.8 inventory_items
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  amount jsonb,
  unit text not null default '',
  priority boolean not null default false,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 2.9 pantry_items
create table if not exists public.pantry_items (
  household_id uuid not null references public.households (id) on delete cascade,
  key text not null,
  display_name text not null,
  ingredient_type text not null,
  stock_status text not null default 'unknown',
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (household_id, key)
);

-- ------------------------------------------------------------
-- 3. index
-- ------------------------------------------------------------
create index if not exists household_members_user_id_idx
  on public.household_members (user_id);

create index if not exists household_invites_household_id_idx
  on public.household_invites (household_id);

create index if not exists recipes_household_id_idx
  on public.recipes (household_id);

create index if not exists recipes_household_sample_idx
  on public.recipes (household_id, is_sample);

create index if not exists recipes_household_name_idx
  on public.recipes (household_id, name);

create index if not exists meal_plans_household_id_idx
  on public.meal_plans (household_id);

create index if not exists shopping_lists_household_id_idx
  on public.shopping_lists (household_id);

create index if not exists inventory_items_household_id_idx
  on public.inventory_items (household_id);

create index if not exists pantry_items_household_id_idx
  on public.pantry_items (household_id);

-- ------------------------------------------------------------
-- 4. updated_at 用関数・trigger
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at
before update on public.households
for each row execute function public.set_updated_at();

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
before update on public.recipes
for each row execute function public.set_updated_at();

drop trigger if exists meal_plans_set_updated_at on public.meal_plans;
create trigger meal_plans_set_updated_at
before update on public.meal_plans
for each row execute function public.set_updated_at();

drop trigger if exists shopping_lists_set_updated_at on public.shopping_lists;
create trigger shopping_lists_set_updated_at
before update on public.shopping_lists
for each row execute function public.set_updated_at();

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

drop trigger if exists pantry_items_set_updated_at on public.pantry_items;
create trigger pantry_items_set_updated_at
before update on public.pantry_items
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5. household_members 等を参照するヘルパー関数
--    ※ テーブル作成後に定義すること
-- ------------------------------------------------------------

-- 所属 household_id を返す（RLS で利用）
create or replace function public.get_my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid()
  limit 1;
$$;

-- auth.users 作成時に profile を自動作成
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'ユーザー')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 6. RPC: 家庭作成・招待発行・参加
-- ------------------------------------------------------------

-- 家庭作成（owner 登録まで一括）
create or replace function public.create_household_with_owner(
  p_name text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household_id uuid;
begin
  if v_uid is null then
    raise exception 'ログインが必要です';
  end if;

  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'すでに家庭へ所属しています';
  end if;

  if trim(coalesce(p_name, '')) = '' then
    raise exception '家庭名を入力してください';
  end if;

  update public.profiles
  set display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
  where id = v_uid;

  insert into public.households (name, created_by)
  values (trim(p_name), v_uid)
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_household_id, v_uid, 'owner');

  return v_household_id;
end;
$$;

-- 招待コード発行（owner のみ）
create or replace function public.create_household_invite(
  p_household_id uuid,
  p_expires_hours integer default 72
)
returns table (id uuid, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_id uuid;
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'ログインが必要です';
  end if;

  if not exists (
    select 1 from public.household_members
    where household_id = p_household_id
      and user_id = v_uid
      and role = 'owner'
  ) then
    raise exception '招待コードを発行できるのはオーナーのみです';
  end if;

  -- 推測されにくいコード（英数字）
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_expires := timezone('utc', now())
    + make_interval(hours => greatest(coalesce(p_expires_hours, 72), 1));

  insert into public.household_invites (household_id, code, created_by, expires_at)
  values (p_household_id, v_code, v_uid, v_expires)
  returning household_invites.id, household_invites.code, household_invites.expires_at
  into v_id, v_code, v_expires;

  return query select v_id, v_code, v_expires;
end;
$$;

-- 招待コードで参加（テーブルを直接公開検索）
create or replace function public.join_household_with_invite(
  p_code text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.household_invites%rowtype;
  v_normalized text;
begin
  if v_uid is null then
    raise exception 'ログインが必要です';
  end if;

  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'すでに家庭へ所属しています';
  end if;

  v_normalized := upper(trim(coalesce(p_code, '')));
  if v_normalized = '' then
    raise exception '招待コードを入力してください';
  end if;

  select * into v_invite
  from public.household_invites
  where code = v_normalized
  for update;

  if not found then
    raise exception '招待コードが正しくありません';
  end if;

  if v_invite.used_at is not null then
    raise exception 'この招待コードは使用済みです';
  end if;

  if v_invite.expires_at < timezone('utc', now()) then
    raise exception '招待コードの有効期限が切れています';
  end if;

  if p_display_name is not null and trim(p_display_name) <> '' then
    update public.profiles
    set display_name = trim(p_display_name)
    where id = v_uid;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_invite.household_id, v_uid, 'member');

  update public.household_invites
  set used_by = v_uid, used_at = timezone('utc', now())
  where id = v_invite.id;

  return v_invite.household_id;
end;
$$;

-- ------------------------------------------------------------
-- 7. RLS 有効化
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.recipes enable row level security;
alter table public.meal_plans enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.inventory_items enable row level security;
alter table public.pantry_items enable row level security;

-- ------------------------------------------------------------
-- 8. RLS policy（get_my_household_id / household_members 利用）
-- ------------------------------------------------------------

-- profiles: 自分のみ更新。同じ家庭のメンバーは表示名を閲覧可
drop policy if exists profiles_select_self_or_household on public.profiles;
create policy profiles_select_self_or_household on public.profiles
for select using (
  id = auth.uid()
  or id in (
    select hm2.user_id
    from public.household_members hm1
    join public.household_members hm2 on hm1.household_id = hm2.household_id
    where hm1.user_id = auth.uid()
  )
);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
for insert with check (id = auth.uid());

-- households
drop policy if exists households_select_member on public.households;
create policy households_select_member on public.households
for select using (
  id = public.get_my_household_id()
);

drop policy if exists households_update_owner on public.households;
create policy households_update_owner on public.households
for update using (
  id = public.get_my_household_id()
  and exists (
    select 1 from public.household_members
    where household_id = id and user_id = auth.uid() and role = 'owner'
  )
);

-- household_members
drop policy if exists household_members_select_same on public.household_members;
create policy household_members_select_same on public.household_members
for select using (household_id = public.get_my_household_id());

-- invites: 所属家庭の招待のみ閲覧（コード総当り防止）
drop policy if exists household_invites_select_member on public.household_invites;
create policy household_invites_select_member on public.household_invites
for select using (household_id = public.get_my_household_id());

-- 共有テーブル
drop policy if exists recipes_all_member on public.recipes;
create policy recipes_all_member on public.recipes
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

drop policy if exists meal_plans_all_member on public.meal_plans;
create policy meal_plans_all_member on public.meal_plans
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

drop policy if exists shopping_lists_all_member on public.shopping_lists;
create policy shopping_lists_all_member on public.shopping_lists
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

drop policy if exists inventory_items_all_member on public.inventory_items;
create policy inventory_items_all_member on public.inventory_items
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

drop policy if exists pantry_items_all_member on public.pantry_items;
create policy pantry_items_all_member on public.pantry_items
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

-- Realtime（任意）: Dashboard でも有効化できます
-- alter publication supabase_realtime add table public.recipes;
-- alter publication supabase_realtime add table public.meal_plans;
-- alter publication supabase_realtime add table public.shopping_lists;
-- alter publication supabase_realtime add table public.inventory_items;
-- alter publication supabase_realtime add table public.pantry_items;

-- ------------------------------------------------------------
-- 9. grant
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select on public.household_invites to authenticated;
grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.meal_plans to authenticated;
grant select, insert, update, delete on public.shopping_lists to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.pantry_items to authenticated;

grant execute on function public.get_my_household_id() to authenticated;
grant execute on function public.create_household_with_owner(text, text) to authenticated;
grant execute on function public.create_household_invite(uuid, integer) to authenticated;
grant execute on function public.join_household_with_invite(text, text) to authenticated;
