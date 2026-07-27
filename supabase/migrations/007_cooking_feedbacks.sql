-- 料理フィードバック・我が家版（家族同期）
-- 未適用でもアプリはローカル保存で動作する

create table if not exists public.cooking_feedbacks (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  history_id text not null,
  recipe_id text not null,
  cooked_at timestamptz not null,
  created_by text null,
  overall_rating integer null,
  want_again boolean null,
  cooking_time_actual_minutes integer null,
  servings_actual integer null,
  improvement_tags jsonb not null default '[]'::jsonb,
  member_ratings jsonb not null default '[]'::jsonb,
  adjustments jsonb not null default '[]'::jsonb,
  seasoning_adjustments jsonb not null default '[]'::jsonb,
  photo_data_url text null,
  memo text null,
  taste_salt text null,
  taste_sweet text null,
  taste_spicy text null,
  texture text null,
  time_feeling text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cooking_feedbacks_household_recipe_idx
  on public.cooking_feedbacks (household_id, recipe_id, cooked_at desc);

create table if not exists public.recipe_variants (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  parent_recipe_id text not null,
  variant_recipe_id text not null,
  title text not null,
  summary text not null default '',
  changes jsonb not null default '[]'::jsonb,
  source_history_ids jsonb not null default '[]'::jsonb,
  source_feedback_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
