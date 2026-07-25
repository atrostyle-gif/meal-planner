# URL取り込み（ハイブリッド方式）

公開レシピページの URL から `RecipeDraft` を生成し、確認画面を経て保存します。読み取り完了時点では保存しません。

## 処理フロー

1. URL検証・安全な HTML 取得（SSRF 対策）
2. JSON-LD Recipe 解析 + **品質判定**
3. 十分なら JSON-LD を採用（AI を呼ばない）
4. 不足なら HTML 前処理 → AI 構造化（Responses API + JSON Schema）
5. サーバー側検証（Zod）
6. JSON-LD / AI / OpenGraph のフィールド単位統合
7. 確認画面 → ユーザー確認後に保存

HTML ルール解析は、AI へ渡す本文候補の抽出と、API キー未設定時の限定フォールバックに使います。サイト別 Adapter による直接抽出への依存は最小です。

## JSON-LD 採用条件

次をすべて満たす場合に「十分」と判定します。

- `title` がある
- 材料が 2 件以上
- 手順が 1 件以上
- タイトルが広告・関連記事系でない

不足していても JSON-LD は破棄せず、AI 入力の補助情報として渡します。

## AI 実行条件

- Recipe JSON-LD がない / 不完全
- 材料または手順が不足
- ユーザーが「AIでもう一度整理する」を選択

省略条件: JSON-LD が十分でバリデーションに成功している場合。

## HTML 前処理

削除: script / style / noscript / iframe / header / footer / nav / aside / form / 広告 / SNS / 関連・おすすめ・ランキング / Cookie 等。

優先: `main` / `article` / 材料・手順見出し周辺。構造を簡略マークダウンとして AI に渡します（文字数上限あり）。生 HTML 全文は送りません。

## Provider

- `RecipeUrlImportProvider`
  - `OpenAIRecipeUrlImportProvider`（本番）
  - `MockRecipeUrlImportProvider`（テスト専用。本番で架空レシピは返さない）
- 写真用は既存の `RecipeImportProvider`（別系統）

モデル名は `OPENAI_RECIPE_IMPORT_MODEL`（未設定時 `gpt-4o-mini`）。

## 構造化出力

OpenAI Responses API + strict JSON Schema。自由文からの正規表現パースは使いません。Zod で再検証します。

## プロンプトインジェクション対策

- ページ本文は「データ」であり指示ではないと system に明記
- script / コメント等は入力から除外
- `sourceUrl` は入力 URL に固定（AI の別 URL は採用しない）

## キャッシュ・コスト

- 同一 URL + HTML ハッシュの短期メモリキャッシュ（約 10 分）
- 連打防止
- タイムアウト
- 不正 JSON 時の再試行は最大 1 回
- 整形本文は一時セッションのみ（永続 DB へは保存しない）

## 環境変数

| 変数 | 説明 |
|------|------|
| `OPENAI_API_KEY` | サーバー側のみ。未設定時は AI 不可メッセージ + 限定フォールバック |
| `OPENAI_RECIPE_IMPORT_MODEL` | 任意。既定 `gpt-4o-mini` |
| `RECIPE_IMPORT_DEBUG` | 開発時のみ `debug-import.html` 保存 |

## UI

- 通常画面は内部コード（`json_ld` 等）を出さない
- 進捗表示（取得 → 確認 → AI整理 → 準備）
- 「AIでもう一度整理する」（結果は確認してから反映）
- 詳細診断は `NODE_ENV === "development"` のみ

## 手動確認

1. `.env.local` に `OPENAI_API_KEY` を設定
2. `npm run dev`
3. `/recipes/import/url` で次を試す
   - Recipe JSON-LD があるレシピ URL（AI がスキップされること）
   - JSON-LD がないレシピ URL（AI で整理されること）
   - レシピではない一般ページ（not_recipe / 失敗メッセージ）

## 未対応・制限

- ログイン必須ページ
- 完全クライアント描画のみのページ
- AI 未設定時の品質は限定的
- サイト別 DOM への過度な依存は意図的に縮小（ルールは補助用途）
