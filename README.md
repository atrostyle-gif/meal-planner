# 家族の献立（meal-planner）

家族向けの献立・レシピ・買い物リストアプリです。

- Next.js（App Router） / TypeScript / Tailwind CSS
- 既定は **localStorage**（ログイン不要）
- 任意で **Supabase** による家族共有・ログイン

## 起動

```bash
npm install
npm run dev
```

http://localhost:3000

## 主な画面

| パス | 内容 |
|------|------|
| `/today` | 今日の献立 |
| `/meals` | 週間献立・余っている食材 |
| `/recipes` | レシピ |
| `/recipes/new` | レシピ追加（手入力 / URL / 写真） |
| `/recipes/import/url` | URLから取り込み |
| `/recipes/import/photo` | 写真から取り込み |
| `/recipes/import/confirm` | 取り込み内容の確認・保存 |
| `/recipes/[id]/cook` | 調理モード |
| `/recipes/new` | 手入力・URL・写真からのレシピ登録 |
| `/settings/pantry` | 常備品 |
| `/shopping` | 買い物リスト |
| `/settings` | 設定 |
| `/settings/family-profiles` | 家族プロフィール（アレルギー・目標） |
| `/settings/weekly-schedule` | 曜日ごとの料理担当・生活スケジュール |
| `/settings/cooking-members` | 調理担当者の作りやすさ |
| `/settings/lifestyle-setup` | 生活スケジュール初期設定 |
| `/nutrition` | 栄養バランス |
| `/login` | ログイン（Supabase 時） |

## 家族共有（任意）

1. `docs/SUPABASE_SETUP.md` に従いプロジェクトと SQL を設定
2. `.env.local` に URL / anon key を設定
3. 開発サーバー再起動
4. `/login` → 家庭作成 → 招待コードで家族参加

関連ドキュメント:

- `docs/SUPABASE_SETUP.md`
- `docs/FAMILY_SHARING.md`
- `docs/LOCAL_TO_SUPABASE_MIGRATION.md`
- `docs/NUTRITION_ENGINE.md`
- `docs/FOOD_MASTER.md`
- `docs/FAMILY_HEALTH_PROFILES.md`
- `docs/WEEKLY_LIFESTYLE_ENGINE.md`
- `docs/COOKING_MEMBER_PROFILES.md`
- `docs/MEAL_PLANNER_V4.md`
- `docs/LEFTOVER_INGREDIENTS.md`
- `docs/RECIPE_IMPORT.md`
- `docs/RECIPE_URL_IMPORT.md`
- `docs/RECIPE_PHOTO_IMPORT.md`
- `PROJECT_SPEC.md` / `DATABASE.md` / `ROADMAP.md`

## 環境変数（任意）

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 家族共有 |
| `OPENAI_API_KEY` | レシピ写真・URL（AI）取り込み（サーバー側のみ） |
| `OPENAI_RECIPE_IMPORT_MODEL` | URL取り込みモデル（未設定時 gpt-4o-mini） |

## スクリプト

```bash
npm run lint
npm run build
npm run test
```
