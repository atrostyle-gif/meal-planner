-- ============================================================
-- meal-planner: 週間生活・調理担当エンジン (003)
-- 001_initial_schema.sql と 002_nutrition_engine.sql の後に実行してください。
-- ============================================================

create extension if not exists "pgcrypto";

alter table public.recipes
  add column if not exists cooking_profile jsonb;

create table if not exists public.weekly_cooking_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  day_of_week text not null,
  default_cook_member_id uuid references public.family_member_profiles (id) on delete set null,
  backup_cook_member_ids jsonb not null default '[]'::jsonb,
  cooking_time_limit_minutes integer,
  effort_level text not null default 'normal',
  shopping_available boolean not null default false,
  is_shopping_day boolean not null default false,
  allow_new_recipes boolean not null default true,
  prefer_familiar_recipes boolean not null default false,
  allow_batch_cooking boolean not null default false,
  prefer_low_cleanup boolean not null default false,
  max_step_count integer,
  avoid_deep_frying boolean not null default false,
  prefer_make_ahead boolean not null default false,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, day_of_week)
);

create table if not exists public.cooking_member_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  family_member_profile_id uuid not null references public.family_member_profiles (id) on delete cascade,
  cooking_level text not null default 'basic',
  default_max_cooking_minutes integer,
  max_comfortable_step_count integer,
  can_deep_fry boolean not null default false,
  can_use_oven boolean not null default true,
  can_use_pressure_cooker boolean not null default false,
  can_handle_raw_fish boolean not null default false,
  prefers_low_cleanup boolean not null default false,
  preferred_recipe_ids jsonb not null default '[]'::jsonb,
  avoid_recipe_ids jsonb not null default '[]'::jsonb,
  mastered_recipe_ids jsonb not null default '[]'::jsonb,
  learning_recipe_ids jsonb not null default '[]'::jsonb,
  preferred_categories jsonb not null default '[]'::jsonb,
  disliked_cooking_methods jsonb not null default '[]'::jsonb,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, family_member_profile_id)
);

create table if not exists public.daily_cooking_overrides (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  date date not null,
  cook_member_id uuid references public.family_member_profiles (id) on delete set null,
  is_eating_out boolean not null default false,
  skip_meal_planning boolean not null default false,
  cooking_time_limit_minutes integer,
  effort_level text,
  shopping_available boolean,
  allow_new_recipes boolean,
  participant_member_ids jsonb not null default '[]'::jsonb,
  notes text,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, date)
);

create table if not exists public.cooking_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  cooked_by_member_id uuid references public.family_member_profiles (id) on delete set null,
  cooked_at timestamptz not null default timezone('utc', now()),
  difficulty_feedback text,
  duration_minutes integer,
  success_rating integer,
  notes text
);

create index if not exists weekly_cooking_schedules_household_id_idx
  on public.weekly_cooking_schedules (household_id);
create index if not exists cooking_member_profiles_household_id_idx
  on public.cooking_member_profiles (household_id);
create index if not exists daily_cooking_overrides_household_id_idx
  on public.daily_cooking_overrides (household_id);
create index if not exists cooking_history_household_id_idx
  on public.cooking_history (household_id);
create index if not exists cooking_history_recipe_id_idx
  on public.cooking_history (recipe_id);

drop trigger if exists weekly_cooking_schedules_set_updated_at on public.weekly_cooking_schedules;
create trigger weekly_cooking_schedules_set_updated_at
before update on public.weekly_cooking_schedules
for each row execute function public.set_updated_at();

drop trigger if exists cooking_member_profiles_set_updated_at on public.cooking_member_profiles;
create trigger cooking_member_profiles_set_updated_at
before update on public.cooking_member_profiles
for each row execute function public.set_updated_at();

drop trigger if exists daily_cooking_overrides_set_updated_at on public.daily_cooking_overrides;
create trigger daily_cooking_overrides_set_updated_at
before update on public.daily_cooking_overrides
for each row execute function public.set_updated_at();

alter table public.weekly_cooking_schedules enable row level security;
alter table public.cooking_member_profiles enable row level security;
alter table public.daily_cooking_overrides enable row level security;
alter table public.cooking_history enable row level security;

drop policy if exists weekly_cooking_schedules_all_member on public.weekly_cooking_schedules;
create policy weekly_cooking_schedules_all_member on public.weekly_cooking_schedules
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

drop policy if exists cooking_member_profiles_all_member on public.cooking_member_profiles;
create policy cooking_member_profiles_all_member on public.cooking_member_profiles
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

drop policy if exists daily_cooking_overrides_all_member on public.daily_cooking_overrides;
create policy daily_cooking_overrides_all_member on public.daily_cooking_overrides
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

drop policy if exists cooking_history_all_member on public.cooking_history;
create policy cooking_history_all_member on public.cooking_history
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

grant select, insert, update, delete on public.weekly_cooking_schedules to authenticated;
grant select, insert, update, delete on public.cooking_member_profiles to authenticated;
grant select, insert, update, delete on public.daily_cooking_overrides to authenticated;
grant select, insert, update, delete on public.cooking_history to authenticated;
