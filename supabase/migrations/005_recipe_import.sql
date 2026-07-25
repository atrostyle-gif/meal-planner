-- レシピ取り込み時の出典と献立向け分類を保持する
alter table public.recipes
  add column if not exists import_method text,
  add column if not exists source jsonb,
  add column if not exists meal_affinity jsonb,
  add column if not exists extraction_warnings jsonb;
