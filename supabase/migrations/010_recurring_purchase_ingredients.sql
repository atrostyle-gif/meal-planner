-- 定期購入食材（コープ等の予約注文）
create table if not exists public.recurring_purchase_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  raw_name text,
  food_master_id text,
  food_code text,
  quantity numeric,
  unit text,
  store_id uuid,
  store_name text,
  arrival_day_of_week text not null default 'friday',
  frequency text not null default 'weekly',
  active boolean not null default true,
  prefer_in_meal_plan boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (arrival_day_of_week in (
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  )),
  check (frequency in ('weekly'))
);

create index if not exists recurring_purchase_ingredients_household_id_idx
  on public.recurring_purchase_ingredients (household_id);
create index if not exists recurring_purchase_ingredients_active_idx
  on public.recurring_purchase_ingredients (household_id, active);

drop trigger if exists recurring_purchase_ingredients_set_updated_at
  on public.recurring_purchase_ingredients;
create trigger recurring_purchase_ingredients_set_updated_at
before update on public.recurring_purchase_ingredients
for each row execute function public.set_updated_at();

alter table public.recurring_purchase_ingredients enable row level security;
drop policy if exists recurring_purchase_ingredients_all_member
  on public.recurring_purchase_ingredients;
create policy recurring_purchase_ingredients_all_member
  on public.recurring_purchase_ingredients
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

grant select, insert, update, delete
  on public.recurring_purchase_ingredients to authenticated;
