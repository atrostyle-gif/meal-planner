# Supabase セットアップ手順

家族共有（ログイン・家庭・招待）を有効にするための手順です。  
未設定のままでは従来どおり **localStorage のみ** で動作します。

## 1. Supabase プロジェクト作成

1. https://supabase.com でアカウント作成
2. New project を作成
3. リージョンと DB パスワードを設定

## 2. URL と anon key の確認

Project Settings → API から次を控えます。

- Project URL
- anon public key

**service_role key はブラウザに置かないでください。**

## 3. `.env.local` への設定

プロジェクト直下に `.env.local` を作成し、`.env.local.example` を参考に設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## 4. SQL migration の実行

1. Supabase Dashboard → SQL Editor を開く
2. `supabase/migrations/001_initial_schema.sql` の内容をすべて貼り付け
3. Run で実行

この1ファイルでテーブル・RLS・RPC・trigger まで入ります。

## 5. Authentication 設定

1. Authentication → Providers → Email を有効化
2. 開発中は Email confirmations をオフにすると動作確認が簡単です
   （本番ではオン推奨）

## 6. Realtime（任意）

今回の実装は **フォーカス復帰時の再取得 + 端末変更の遅延プッシュ** が基本です。  
Realtime を使う場合は SQL 末尾のコメントを外すか、Database → Replication で対象テーブルを有効化してください。

- recipes
- meal_plans
- shopping_lists
- inventory_items
- pantry_items

## 7. 開発サーバー再起動

```bash
npm run dev
```

環境変数変更後は必ず再起動してください。

## 8. 最初のアカウント作成

1. `/login` を開く
2. 「新規アカウントを作成」
3. メール・パスワード・表示名を入力

## 9. 家庭作成

1. `/setup-household` へ誘導されます
2. 家庭名（例: 平元家）と表示名を入力
3. 「家庭を作成」

## 10. 家族招待

1. `/settings/family` を開く
2. オーナーが招待コードを発行
3. 家族は別アカウントでログインし、同じ画面またはセットアップ画面でコード入力

## 11. よくあるエラー

| 症状 | 確認点 |
|------|--------|
| ずっと local モード | `.env.local` とサーバー再起動 |
| ログインできない | Email provider / 確認メール設定 |
| 家庭データが見えない | SQL migration 実行済みか、RLS/RPC エラー |
| 招待コード無効 | 期限切れ・使用済み・大文字小文字 |
| 同期されない | 設定の「最新データを取得」、ネットワーク |

詳細は `docs/FAMILY_SHARING.md` と `docs/LOCAL_TO_SUPABASE_MIGRATION.md` も参照してください。
