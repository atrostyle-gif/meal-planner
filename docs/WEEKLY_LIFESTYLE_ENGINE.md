# 週間生活スケジュールエンジン

家庭の曜日ごとの生活リズム（料理担当・時間・買い出し・作り置きなど）を献立提案へ反映します。

## 概要

- 毎週繰り返す基本設定: `WeeklyCookingSchedule`
- 特定日の例外: `DailyCookingOverride`
- 未設定の曜日は従来の献立エンジン（v3）へフォールバック

## 主な項目

| 項目 | 意味 |
|------|------|
| defaultCookMemberId | その曜日の料理担当 |
| cookingTimeLimitMinutes | 調理時間の上限 |
| effortLevel | 手間の許容（とても簡単〜制限なし） |
| isShoppingDay / shoppingAvailable | 買い出し日・買い足し可否 |
| allowNewRecipes | 新しい料理を候補に含めるか |
| preferFamiliarRecipes | 作り慣れた料理を優先 |
| allowBatchCooking / preferMakeAhead | 作り置き向き |
| preferLowCleanup | 洗い物が少ない料理を優先 |
| maxStepCount | 工程数の上限 |
| avoidDeepFrying | 揚げ物を避ける |

## 設定画面

- `/settings/weekly-schedule` … 曜日ごとの基本設定
- `/settings/lifestyle-setup` … 初回ウィザード
- 献立画面の「今日だけ設定」… 外食・献立不要・担当変更・時間変更

## 初期プリセット

設定画面の「家庭向けプリセット」で、月＝妻（買い出し）／火水＝夫（時短）／木＝妻／金＝娘（初心者）／土日＝夫（余裕）を一括登録できます。

## 保存

- localStorage: `meal-planner:weeklyCookingSchedules` / `dailyCookingOverrides`
- Supabase: `weekly_cooking_schedules` / `daily_cooking_overrides`（migration `003`）
- `householdId` で家庭ごとに分離

## フォールバック

スケジュール未設定・担当者未設定でもエラーにせず、v3 相当の提案を続けます。
