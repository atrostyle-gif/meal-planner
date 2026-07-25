# 食材マスター

## 概要

`FoodIngredientMaster` が栄養計算の基準です。家庭固有の別名は `FoodAliasMapping` に分離します。

## サンプル

- 件数: `SAMPLE_FOOD_MASTER_COUNT`（`lib/food-master/sample-data.ts`）
- 出典メモ: `meal-planner-sample` / `v1`（概算値）

## 紐付け

1. 家庭 alias map
2. canonical 完全一致
3. aliases 一致
4. 部分一致（要確認）

未紐付け材料は栄養計算対象外です。
