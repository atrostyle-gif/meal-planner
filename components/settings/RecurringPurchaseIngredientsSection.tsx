"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useSyncExternalStore } from "react";
import {
  deleteRecurringPurchaseIngredient,
  getRecurringPurchaseIngredientsServerSnapshot,
  getRecurringPurchaseIngredientsSnapshot,
  saveRecurringPurchaseIngredient,
  subscribeRecurringPurchaseIngredients,
  updateRecurringPurchaseIngredient,
} from "@/lib/recurring-purchase-ingredients";
import {
  getStoresServerSnapshot,
  getStoresSnapshot,
  subscribeStores,
} from "@/lib/stores/store-repository";
import {
  DAY_OF_WEEK_LABELS,
  DAYS_OF_WEEK,
  type DayOfWeek,
} from "@/types/weekly-lifestyle";
import {
  RECURRING_PURCHASE_FREQUENCY_LABELS,
  type RecurringPurchaseIngredient,
} from "@/types/recurring-purchase-ingredient";

export function RecurringPurchaseIngredientsSection() {
  const items = useSyncExternalStore(
    subscribeRecurringPurchaseIngredients,
    getRecurringPurchaseIngredientsSnapshot,
    getRecurringPurchaseIngredientsServerSnapshot,
  );
  const stores = useSyncExternalStore(
    subscribeStores,
    getStoresSnapshot,
    getStoresServerSnapshot,
  );

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [arrivalDayOfWeek, setArrivalDayOfWeek] = useState<DayOfWeek>("friday");
  const [preferInMealPlan, setPreferInMealPlan] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.name.localeCompare(b.name, "ja"),
      ),
    [items],
  );

  function resetForm(): void {
    setName("");
    setQuantity("");
    setUnit("");
    setStoreId("");
    setStoreName("");
    setArrivalDayOfWeek("friday");
    setPreferInMealPlan(true);
    setEditingId(null);
  }

  function startEdit(item: RecurringPurchaseIngredient): void {
    setEditingId(item.id);
    setName(item.rawName || item.name);
    setQuantity(item.quantity != null ? String(item.quantity) : "");
    setUnit(item.unit ?? "");
    setStoreId(item.storeId ?? "");
    setStoreName(item.storeName ?? "");
    setArrivalDayOfWeek(item.arrivalDayOfWeek);
    setPreferInMealPlan(item.preferInMealPlan);
    setMessage(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (name.trim() === "") {
      setMessage("食材名を入力してください");
      return;
    }

    const parsedQuantity =
      quantity.trim() === "" ? null : Number(quantity.trim());
    if (parsedQuantity != null && !Number.isFinite(parsedQuantity)) {
      setMessage("数量は数値で入力してください");
      return;
    }

    const selectedStore = stores.find((store) => store.id === storeId);
    const resolvedStoreName =
      storeName.trim() ||
      selectedStore?.name ||
      null;

    if (editingId) {
      updateRecurringPurchaseIngredient(editingId, {
        name: name.trim(),
        rawName: name.trim(),
        quantity: parsedQuantity,
        unit: unit.trim() || null,
        storeId: storeId || null,
        storeName: resolvedStoreName,
        arrivalDayOfWeek,
        frequency: "weekly",
        preferInMealPlan,
      });
      setMessage("定期購入食材を更新しました");
    } else {
      saveRecurringPurchaseIngredient({
        name: name.trim(),
        rawName: name.trim(),
        quantity: parsedQuantity,
        unit: unit.trim() || null,
        storeId: storeId || null,
        storeName: resolvedStoreName,
        arrivalDayOfWeek,
        frequency: "weekly",
        active: true,
        preferInMealPlan,
      });
      setMessage("定期購入食材を登録しました");
    }
    resetForm();
  }

  return (
    <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <div>
        <h2 className="text-lg font-semibold text-on-surface">定期購入食材</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          コープなど毎週届く食材を登録します。到着日以降の献立で在庫として扱い、買い物リストでは二重購入を防ぎます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-surface-container p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium text-on-surface-variant">食材名</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-outline-variant"
              placeholder="例: 牛乳"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-on-surface-variant">数量</span>
            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-outline-variant"
              placeholder="例: 1"
              inputMode="decimal"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-on-surface-variant">単位</span>
            <input
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              className="w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-outline-variant"
              placeholder="例: 本"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-on-surface-variant">購入先（登録店舗）</span>
            <select
              value={storeId}
              onChange={(event) => {
                setStoreId(event.target.value);
                const selected = stores.find((store) => store.id === event.target.value);
                if (selected) setStoreName(selected.name);
              }}
              className="w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-outline-variant"
            >
              <option value="">未選択</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-on-surface-variant">購入先（自由入力）</span>
            <input
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              className="w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-outline-variant"
              placeholder="例: コープ"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-on-surface-variant">到着曜日</span>
            <select
              value={arrivalDayOfWeek}
              onChange={(event) =>
                setArrivalDayOfWeek(event.target.value as DayOfWeek)
              }
              className="w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-outline-variant"
            >
              {DAYS_OF_WEEK.map((day) => (
                <option key={day} value={day}>
                  {DAY_OF_WEEK_LABELS[day]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2">
            <input
              type="checkbox"
              checked={preferInMealPlan}
              onChange={(event) => setPreferInMealPlan(event.target.checked)}
            />
            <span className="text-sm">献立で優先使用する</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
          >
            {editingId ? "更新する" : "登録する"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl px-4 py-2 text-sm font-medium text-on-surface-variant ring-1 ring-outline-variant"
            >
              キャンセル
            </button>
          ) : null}
        </div>
      </form>

      {message ? (
        <p className="text-sm text-primary">{message}</p>
      ) : null}

      {sortedItems.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          まだ定期購入食材が登録されていません
        </p>
      ) : (
        <ul className="space-y-3">
          {sortedItems.map((item) => (
            <li
              key={item.id}
              className="space-y-2 rounded-xl bg-surface-container px-3 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold">{item.name}</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {item.quantity != null
                      ? `${item.quantity}${item.unit ?? ""}`
                      : "数量未設定"}
                    {" ・ "}
                    {RECURRING_PURCHASE_FREQUENCY_LABELS[item.frequency]}
                    {" ・ "}
                    {DAY_OF_WEEK_LABELS[item.arrivalDayOfWeek]}到着
                    {item.storeName ? ` ・ ${item.storeName}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {item.preferInMealPlan
                      ? "献立で優先使用"
                      : "献立優先なし"}
                    {" ・ "}
                    {item.active ? "有効" : "無効"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="text-xs text-primary"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateRecurringPurchaseIngredient(item.id, {
                        active: !item.active,
                      });
                      setMessage(
                        item.active ? "無効にしました" : "有効にしました",
                      );
                    }}
                    className="text-xs text-primary"
                  >
                    {item.active ? "無効化" : "有効化"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !window.confirm(`「${item.name}」を削除しますか？`)
                      ) {
                        return;
                      }
                      deleteRecurringPurchaseIngredient(item.id);
                      if (editingId === item.id) resetForm();
                      setMessage("削除しました");
                    }}
                    className="text-xs text-error"
                  >
                    削除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
