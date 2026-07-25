-- ============================================================
-- meal-planner: 栄養エンジン / 家族プロフィール (002)
-- 001_initial_schema.sql の後に実行してください。
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- family_member_profiles
-- ------------------------------------------------------------
create table if not exists public.family_member_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  birth_year integer,
  age_group text not null default '未設定',
  sex text,
  activity_level text not null default '未設定',
  calorie_target numeric,
  protein_target numeric,
  salt_limit numeric,
  goals jsonb not null default '[]'::jsonb,
  allergies jsonb not null default '[]'::jsonb,
  disliked_ingredients jsonb not null default '[]'::jsonb,
  dietary_restrictions jsonb not null default '["なし"]'::jsonb,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists family_member_profiles_household_id_idx
  on public.family_member_profiles (household_id);

drop trigger if exists family_member_profiles_set_updated_at on public.family_member_profiles;
create trigger family_member_profiles_set_updated_at
before update on public.family_member_profiles
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- household_nutrition_preferences
-- ------------------------------------------------------------
create table if not exists public.household_nutrition_preferences (
  household_id uuid primary key references public.households (id) on delete cascade,
  default_auto_fill_mode text not null default 'バランス重視',
  show_nutrition_disclaimer boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists household_nutrition_preferences_set_updated_at
  on public.household_nutrition_preferences;
create trigger household_nutrition_preferences_set_updated_at
before update on public.household_nutrition_preferences
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- daily_conditions
-- ------------------------------------------------------------
create table if not exists public.daily_conditions (
  household_id uuid not null references public.households (id) on delete cascade,
  date date not null,
  selected_conditions jsonb not null default '["通常"]'::jsonb,
  notes text,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (household_id, date)
);

-- ------------------------------------------------------------
-- food_alias_mappings（家庭固有の別名）
-- ------------------------------------------------------------
create table if not exists public.food_alias_mappings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  alias_name text not null,
  master_id text not null,
  exclude_from_nutrition boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, alias_name)
);

create index if not exists food_alias_mappings_household_id_idx
  on public.food_alias_mappings (household_id);

drop trigger if exists food_alias_mappings_set_updated_at on public.food_alias_mappings;
create trigger food_alias_mappings_set_updated_at
before update on public.food_alias_mappings
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.family_member_profiles enable row level security;
alter table public.household_nutrition_preferences enable row level security;
alter table public.daily_conditions enable row level security;
alter table public.food_alias_mappings enable row level security;

drop policy if exists family_member_profiles_all_member on public.family_member_profiles;
create policy family_member_profiles_all_member on public.family_member_profiles
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

drop policy if exists household_nutrition_preferences_all_member
  on public.household_nutrition_preferences;
create policy household_nutrition_preferences_all_member
on public.household_nutrition_preferences
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

drop policy if exists daily_conditions_all_member on public.daily_conditions;
create policy daily_conditions_all_member on public.daily_conditions
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

drop policy if exists food_alias_mappings_all_member on public.food_alias_mappings;
create policy food_alias_mappings_all_member on public.food_alias_mappings
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

grant select, insert, update, delete on public.family_member_profiles to authenticated;
grant select, insert, update, delete on public.household_nutrition_preferences to authenticated;
grant select, insert, update, delete on public.daily_conditions to authenticated;
grant select, insert, update, delete on public.food_alias_mappings to authenticated;
