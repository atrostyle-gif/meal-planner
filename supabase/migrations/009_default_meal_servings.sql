-- 家庭の通常食事人数（献立日別人数の default 元）
alter table public.households
  add column if not exists default_meal_servings integer not null default 4
  check (default_meal_servings >= 1 and default_meal_servings <= 20);

comment on column public.households.default_meal_servings is
  '通常の食事人数。献立の日別 servingsMode=default のときに使う';
