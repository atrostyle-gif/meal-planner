# DATABASE.md — データ設計（localStorage）

## 1. 方針

初期段階では外部 DB（Supabase 等）を使わず、ブラウザの localStorage に JSON を保存する。

- キーごとに JSON 文字列を保存する
- 型は TypeScript で定義し、`any` は使わない
- ID はクライアント生成の文字列（例: `crypto.randomUUID()`）とする
- 日時は ISO 8601 文字列とする

## 2. localStorage キー一覧

| キー | 内容 |
|------|------|
| `meal-planner:recipes` | レシピ一覧 |
| `meal-planner:mealPlans` | 週単位の献立 |
| `meal-planner:fixedMeals` | 曜日ごとの固定献立 |
| `meal-planner:inventory` | 冷蔵庫の残り食材 |
| `meal-planner:leftoverIngredients` | 献立で活かしたい余り食材 |
| `meal-planner:familyMemberProfiles` | 家族プロフィール |
| `meal-planner:foodMasters` | 食材マスター |
| `meal-planner:foodAliasMappings` | 家庭固有の食材別名 |
| `meal-planner:dailyConditions` | 日別体調 |
| `meal-planner:mealPreferences` | 献立エンジン設定 |
| `meal-planner:weeklyCookingSchedules` | 曜日別生活・調理スケジュール |
| `meal-planner:cookingMemberProfiles` | 調理担当者プロフィール |
| `meal-planner:dailyCookingOverrides` | 特定日の例外設定 |
| `meal-planner:cookingHistory` | 調理実績 |

将来スキーマを変える場合に備え、必要なら `meal-planner:schemaVersion` を追加できる。

### Supabase（任意・家族共有）

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 設定時のみ利用。

主要テーブル:

- profiles / households / household_members / household_invites
- recipes / meal_plans / shopping_lists / inventory_items / pantry_items
- family_member_profiles / household_nutrition_preferences / daily_conditions / food_alias_mappings（002）
- weekly_cooking_schedules / cooking_member_profiles / daily_cooking_overrides / cooking_history（003）
- leftover_ingredients（004）
- recipes.cooking_profile（jsonb・003）

詳細 SQL:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_nutrition_engine.sql`
- `supabase/migrations/003_weekly_lifestyle_engine.sql`
- `supabase/migrations/004_leftover_ingredients.sql`
- `supabase/migrations/005_recipe_import.sql`（`import_method` / `source` / `meal_affinity` / `extraction_warnings`）

- `supabase/migrations/004_leftover_ingredients.sql`

## 3. 型定義（論理モデル）

### 3.1 Recipe（レシピ）

```ts
type Ingredient = {
  id: string;
  name: string;       // 材料名（例: 玉ねぎ）
  amount: string;     // 分量（例: 1個、200g）。自由記述でよい
};

type Recipe = {
  id: string;
  name: string;                 // 料理名
  ingredients: Ingredient[];
  instructions?: string;        // 作り方
  memo?: string;
  createdAt: string;
  updatedAt: string;
};
```

保存形式: `Recipe[]`

### 3.2 MealPlan（1週間の献立）

1週間をまとめて1レコードとする。

```ts
type MealSlot = {
  date: string;        // YYYY-MM-DD
  recipeId: string | null;
  isFixed: boolean;    // 固定献立から反映されたか
  source: "manual" | "fixed" | "auto";
};

type MealPlan = {
  id: string;
  weekStart: string;   // その週の開始日 YYYY-MM-DD
  slots: MealSlot[];   // 7日分
  createdAt: string;
  updatedAt: string;
};
```

保存形式: `MealPlan[]`

補足:

- 初期は「1日1食（夕食など）」を想定する
- 朝昼夜に分けるのは将来拡張とし、今は持たない

### 3.3 FixedMeal（固定献立）

曜日ごとに固定で入れるレシピを保持する。

```ts
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=日曜 … 6=土曜（JS Date に合わせる）

type FixedMeal = {
  weekday: Weekday;
  recipeId: string | null;
};
```

保存形式: `FixedMeal[]`（7件、または設定済み曜日のみ）

### 3.4 InventoryItem（冷蔵庫の残り食材）

```ts
type InventoryItem = {
  id: string;
  name: string;          // 食材名
  amount?: string;       // 残量（任意・自由記述）
  updatedAt: string;
};
```

保存形式: `InventoryItem[]`

### 3.5 Settings（設定）

```ts
type Settings = {
  weekStartsOn: Weekday; // 週の開始曜日（初期: 1=月曜）
};
```

## 4. リレーション（論理）

```
Recipe 1 ---- * MealSlot.recipeId
Recipe 1 ---- * FixedMeal.recipeId
InventoryItem は名前ベースで材料と突き合わせる（厳密なマスタ ID は持たない）
```

在庫とレシピ材料の対応は、初期は **材料名・食材名の文字列一致（前後空白除去・大文字小文字は日本語中心のため実質そのまま）** で行う。

## 5. 導出データ（保存しない）

以下は永続化せず、画面表示時に計算する。

### 5.1 買い物リスト

```ts
type ShoppingListItem = {
  name: string;
  amountNeeded: string;   // 献立から集計した必要量（表示用）
  fromInventory: boolean; // 在庫で賄えたか（参考）
};
```

計算イメージ:

1. 対象週の `MealSlot` からレシピを集める
2. 全材料を名前ごとにまとめる
3. `InventoryItem` にある名前を差し引く（初期は「同名があれば不足なし／または残量テキストを併記」程度の簡易ルール）
4. 不足分を買い物リストとして表示する

初期の在庫差し引きは厳密な単位換算をせず、運用で迷わない範囲の簡易ロジックとする。

## 6. 空き日自動作成・在庫優先のルール（データ利用）

入力:

- 対象週の `MealPlan.slots`
- 全 `Recipe`
- 任意で `InventoryItem[]`
- `FixedMeal`（先に反映済みである想定）

処理概要:

1. `recipeId === null` のスロットだけ対象にする
2. 候補レシピから、すでに同週で多用しすぎないよう簡易に分散する
3. 在庫がある場合、材料名が在庫と重なるレシピを優先する
4. 選んだ `recipeId` をスロットへ書き込み、`source: "auto"` とする

固定献立や手動入力済みの日は上書きしない。

## 7. CRUD 操作の単位

| エンティティ | 作成 | 読取 | 更新 | 削除 |
|--------------|------|------|------|------|
| Recipe | ○ | ○ | ○ | ○（参照中の献立は `recipeId` を null にするか警告） |
| MealPlan | ○（週ごと） | ○ | ○（スロット単位） | △（通常不要） |
| FixedMeal | ○ | ○ | ○ | ○（recipeId を null） |
| InventoryItem | ○ | ○ | ○ | ○ |

## 8. 初期データ

初回起動時:

- 各キーが無ければ空配列 / デフォルト設定を書き込む
- サンプルレシピは必須としない（必要なら後からシード可能）

## 9. 将来の移行（参考・未実装）

Supabase 等へ移行する場合の対応イメージ:

| localStorage | 将来テーブル案 |
|--------------|----------------|
| recipes | recipes |
| mealPlans / slots | meal_plans, meal_slots |
| fixedMeals | fixed_meals |
| inventory | inventory_items |

初期段階ではテーブル実装・同期・RLS・ログインは行わない。
