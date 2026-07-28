"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  formatSeasonMonths,
  listSubstituteMasters,
} from "@/lib/food-master/resolve";
import {
  loadFoodMasters,
  resetFoodMastersToSample,
  subscribeFoodMasters,
  upsertFoodMaster,
} from "@/lib/food-master/store";
import {
  FOOD_FREEZABLE_LABELS,
  FOOD_FREEZABLE_LEVELS,
  FOOD_STORAGE_TYPE_LABELS,
  FOOD_STORAGE_TYPES,
  type FoodFreezableLevel,
  type FoodIngredientMaster,
  type FoodStorageType,
} from "@/types/food-master";

function useFoodMasters(): FoodIngredientMaster[] {
  return useSyncExternalStore(
    subscribeFoodMasters,
    loadFoodMasters,
    loadFoodMasters,
  );
}

export function FoodMasterSettingsPage() {
  const masters = useFoodMasters();
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return masters;
    return masters.filter((master) => {
      const blob = [
        master.canonicalName,
        master.foodCode,
        master.category,
        ...master.aliases,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(key);
    });
  }, [masters, query]);

  function handleSave(
    master: FoodIngredientMaster,
    patch: Partial<FoodIngredientMaster>,
  ): void {
    upsertFoodMaster({ ...master, ...patch });
    setMessage("保存しました");
  }

  return (
    <div className="space-y-6">
      <Link href="/settings" className="text-sm text-primary">
        ← 設定
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">食材マスター</h1>
        <p className="text-sm text-on-surface-variant">
          別名・旬・保存・代替など、アプリ共通の食材辞書です
        </p>
      </header>

      {message ? (
        <p className="rounded-xl bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="食材名・別名で検索"
          className="min-h-12 flex-1 rounded-xl bg-surface-container-lowest px-3 py-2 text-sm ring-1 ring-outline-variant"
        />
        <button
          type="button"
          onClick={() => {
            if (
              !window.confirm(
                "サンプルの食材マスターに戻しますか？（編集内容は上書きされます）",
              )
            ) {
              return;
            }
            const count = resetFoodMastersToSample();
            setMessage(`サンプル ${count} 件を入れ直しました`);
            setExpandedId(null);
          }}
          className="min-h-12 rounded-xl bg-secondary-container px-4 py-2 text-sm font-semibold text-on-secondary-container"
        >
          サンプルに戻す
        </button>
      </div>

      <p className="text-xs text-on-surface-variant">
        {filtered.length} / {masters.length} 件
      </p>

      <ul className="space-y-3">
        {filtered.map((master) => {
          const open = expandedId === master.id;
          const substitutes = listSubstituteMasters(master, masters);
          return (
            <li
              key={master.id}
              className="rounded-2xl bg-surface-container-lowest ring-1 ring-outline-variant"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedId((current) =>
                    current === master.id ? null : master.id,
                  )
                }
                className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">{master.canonicalName}</p>
                  <p className="text-xs text-on-surface-variant">
                    {master.category}
                    {master.subcategory ? ` / ${master.subcategory}` : ""}
                    {" · "}
                    {formatSeasonMonths(master.seasonMonths)}
                    {master.storageType
                      ? ` · ${FOOD_STORAGE_TYPE_LABELS[master.storageType]}`
                      : ""}
                  </p>
                  {master.aliases.length > 0 ? (
                    <p className="text-xs text-on-surface-variant">
                      別名: {master.aliases.slice(0, 4).join("、")}
                      {master.aliases.length > 4 ? "…" : ""}
                    </p>
                  ) : null}
                </div>
                <span className="text-xs text-primary">{open ? "▲" : "▼"}</span>
              </button>

              {open ? (
                <div className="space-y-3 border-t border-outline-variant px-4 py-4">
                  <label className="block space-y-1 text-sm">
                    <span className="text-on-surface-variant">別名（読点区切り）</span>
                    <input
                      defaultValue={master.aliases.join("、")}
                      onBlur={(event) => {
                        const aliases = event.target.value
                          .split(/[、,]/)
                          .map((item) => item.trim())
                          .filter(Boolean);
                        handleSave(master, { aliases });
                      }}
                      className="min-h-11 w-full rounded-xl px-3 py-2 ring-1 ring-outline-variant"
                    />
                  </label>

                  <label className="block space-y-1 text-sm">
                    <span className="text-on-surface-variant">
                      旬の月（例: 6,7,8）
                    </span>
                    <input
                      defaultValue={master.seasonMonths.join(",")}
                      onBlur={(event) => {
                        const seasonMonths = event.target.value
                          .split(/[,、\s]+/)
                          .map((item) => Number(item))
                          .filter((item) => item >= 1 && item <= 12);
                        handleSave(master, { seasonMonths });
                      }}
                      className="min-h-11 w-full rounded-xl px-3 py-2 ring-1 ring-outline-variant"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1 text-sm">
                      <span className="text-on-surface-variant">保存方法</span>
                      <select
                        defaultValue={master.storageType ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          handleSave(master, {
                            storageType:
                              value === ""
                                ? null
                                : (value as FoodStorageType),
                          });
                        }}
                        className="min-h-11 w-full rounded-xl px-3 py-2 ring-1 ring-outline-variant"
                      >
                        <option value="">未設定</option>
                        {FOOD_STORAGE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {FOOD_STORAGE_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block space-y-1 text-sm">
                      <span className="text-on-surface-variant">冷凍</span>
                      <select
                        defaultValue={master.freezable ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          handleSave(master, {
                            freezable:
                              value === ""
                                ? null
                                : (value as FoodFreezableLevel),
                          });
                        }}
                        className="min-h-11 w-full rounded-xl px-3 py-2 ring-1 ring-outline-variant"
                      >
                        <option value="">未設定</option>
                        {FOOD_FREEZABLE_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {FOOD_FREEZABLE_LABELS[level]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-1 text-sm">
                    <span className="text-on-surface-variant">
                      購入後の目安日数
                    </span>
                    <input
                      type="number"
                      min={0}
                      defaultValue={master.recommendedShelfLifeDays ?? ""}
                      onBlur={(event) => {
                        const raw = event.target.value.trim();
                        handleSave(master, {
                          recommendedShelfLifeDays:
                            raw === "" ? null : Number(raw),
                        });
                      }}
                      className="min-h-11 w-full rounded-xl px-3 py-2 ring-1 ring-outline-variant"
                    />
                  </label>

                  <label className="block space-y-1 text-sm">
                    <span className="text-on-surface-variant">
                      代替食材コード（カンマ区切り）
                    </span>
                    <input
                      defaultValue={master.substituteFoods.join(",")}
                      onBlur={(event) => {
                        const substituteFoods = event.target.value
                          .split(/[,、\s]+/)
                          .map((item) => item.trim())
                          .filter(Boolean);
                        handleSave(master, { substituteFoods });
                      }}
                      className="min-h-11 w-full rounded-xl px-3 py-2 ring-1 ring-outline-variant"
                    />
                  </label>

                  {substitutes.length > 0 ? (
                    <p className="text-xs text-on-surface-variant">
                      代替:{" "}
                      {substitutes.map((item) => item.canonicalName).join("、")}
                    </p>
                  ) : null}

                  <p className="text-xs text-on-surface-variant">
                    foodCode: {master.foodCode} · 単位: {master.defaultUnit}
                    {master.freezable
                      ? ` · 冷凍${FOOD_FREEZABLE_LABELS[master.freezable]}`
                      : ""}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
