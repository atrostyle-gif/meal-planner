-- 余り食材。既存の inventory_items は後方互換のため変更しない。
create table if not exists public.leftover_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  food_master_id text,
  quantity numeric,
  unit text,
  priority text not null default 'normal',
  notes text,
  source text not null default 'manual',
  status text not null default 'active',
  planned_for_dates jsonb not null default '[]'::jsonb,
  migrated_from_inventory_id uuid,
  include_in_proposal boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (priority in ('normal', 'soon', 'must_use')),
  check (source in ('manual', 'previous_meal', 'shopping_remainder', 'migrated_fridge')),
  check (status in ('active', 'planned', 'used', 'dismissed'))
);

create index if not exists leftover_ingredients_household_id_idx
  on public.leftover_ingredients (household_id);
create index if not exists leftover_ingredients_active_idx
  on public.leftover_ingredients (household_id, status, include_in_proposal);
create unique index if not exists leftover_ingredients_migrated_inventory_idx
  on public.leftover_ingredients (household_id, migrated_from_inventory_id)
  where migrated_from_inventory_id is not null;

drop trigger if exists leftover_ingredients_set_updated_at on public.leftover_ingredients;
create trigger leftover_ingredients_set_updated_at
before update on public.leftover_ingredients
for each row execute function public.set_updated_at();

alter table public.leftover_ingredients enable row level security;
drop policy if exists leftover_ingredients_all_member on public.leftover_ingredients;
create policy leftover_ingredients_all_member on public.leftover_ingredients
for all using (household_id = public.get_my_household_id())
with check (household_id = public.get_my_household_id());

grant select, insert, update, delete on public.leftover_ingredients to authenticated;
