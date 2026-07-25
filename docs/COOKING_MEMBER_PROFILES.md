# 調理担当者プロフィール

健康プロフィール（アレルギー・目標）とは別に、**誰がどれだけ料理できるか**を管理します。

## 型

`CookingMemberProfile`

- `cookingLevel`: beginner / basic / intermediate / advanced
- 扱える調理法: 揚げ物・オーブン・圧力鍋・生魚
- 時間・工程の目安: `defaultMaxCookingMinutes` / `maxComfortableStepCount`
- レシピリスト:
  - `preferredRecipeIds` … 得意・好み
  - `masteredRecipeIds` … 作り慣れている
  - `learningRecipeIds` … 挑戦中
  - `avoidRecipeIds` … 提案しない

## 重要

- 「レシピ自体の難易度」と「その人にとっての難易度」は別です
- 個別設定を実績の自動判定で上書きしません
- 作った回数 3 回以上は「作り慣れた候補」としてスコアに使います（手動 mastered を置き換えません）

## 設定画面

`/settings/cooking-members`

## 調理実績

`CookingHistory` … 調理モード完了時に任意記録。

- localStorage: `meal-planner:cookingHistory`
- Supabase: `cooking_history`

## 同期

`householdId` 単位で push / pull。RLS は家庭メンバーのみ。
