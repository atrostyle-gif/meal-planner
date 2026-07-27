-- 食費取引・月間予算（家族同期）
-- 未適用でもアプリはローカル保存で動作し、同期時はエラーを収集する

create table if not exists public.food_expense_transactions (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  receipt_id uuid null,
  store_id uuid null,
  store_name text not null default '',
  purchased_at timestamptz not null,
  subtotal_yen integer null,
  discount_yen integer null,
  tax_yen integer null,
  total_amount_yen integer not null,
  payment_method text not null default 'unknown',
  category_breakdown jsonb not null default '[]'::jsonb,
  source text not null default 'receipt',
  detail_completeness text not null default 'full_items',
  memo text not null default '',
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_expense_transactions_household_idx
  on public.food_expense_transactions (household_id, purchased_at desc);

create table if not exists public.food_budget_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  settings_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
