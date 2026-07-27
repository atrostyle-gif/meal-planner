-- レシート学習・価格履歴・店舗マッピング（家族同期）
-- 未適用でもローカル動作は壊れない

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  normalized_name text not null default '',
  aliases jsonb not null default '[]'::jsonb,
  store_type text not null default 'supermarket',
  is_primary boolean not null default false,
  prefers_bulk_purchase boolean not null default false,
  default_pack_size_multiplier numeric not null default 1.5,
  store_brand_name text,
  store_branch_name text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stores_household_idx on public.stores (household_id);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  store_id uuid,
  store_name text not null,
  purchased_at timestamptz,
  total_amount_yen numeric,
  receipt_fingerprint text not null,
  keep_image boolean not null default false,
  confidence numeric,
  warnings jsonb not null default '[]'::jsonb,
  raw_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists receipts_household_fingerprint_uidx
  on public.receipts (household_id, receipt_fingerprint);
create index if not exists receipts_household_idx on public.receipts (household_id);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  raw_product_name text not null,
  normalized_ingredient_name text not null default '',
  ingredient_name text not null default '',
  quantity numeric,
  unit text,
  package_count numeric,
  package_quantity numeric,
  package_unit text,
  grams_equivalent numeric,
  unit_price_yen numeric,
  total_price_yen numeric,
  discount_yen numeric,
  tax_included boolean,
  confidence numeric,
  price_record_id uuid
);

create index if not exists receipt_items_receipt_idx on public.receipt_items (receipt_id);
create index if not exists receipt_items_household_idx on public.receipt_items (household_id);

create table if not exists public.store_product_mappings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  store_id uuid,
  store_name text not null,
  raw_product_name text not null,
  normalized_raw_product_name text not null,
  normalized_ingredient_name text not null,
  food_code text,
  match_source text not null default 'unknown',
  confirmation_count integer not null default 0,
  correction_count integer not null default 0,
  confidence numeric not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_product_mappings_household_idx
  on public.store_product_mappings (household_id);
create index if not exists store_product_mappings_raw_idx
  on public.store_product_mappings (household_id, normalized_raw_product_name);

create table if not exists public.ingredient_prices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  ingredient_name text not null,
  normalized_ingredient_name text not null,
  food_code text,
  store_id uuid,
  store_name text not null,
  store_brand_name text,
  store_branch_name text,
  purchase_price_yen numeric not null,
  original_price_yen numeric,
  package_quantity numeric not null default 1,
  package_count numeric,
  package_unit text not null default '',
  grams_equivalent numeric,
  unit_count_equivalent numeric,
  price_per_100g numeric,
  price_per_unit numeric,
  purchased_at timestamptz not null,
  is_sale_price boolean not null default false,
  memo text not null default '',
  source text not null default 'manual',
  receipt_id uuid,
  raw_product_name text,
  discount_yen numeric,
  confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ingredient_prices_household_idx
  on public.ingredient_prices (household_id);
create index if not exists ingredient_prices_ingredient_idx
  on public.ingredient_prices (household_id, normalized_ingredient_name);

alter table public.stores enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.store_product_mappings enable row level security;
alter table public.ingredient_prices enable row level security;
