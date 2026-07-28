import { describe, expect, it } from "vitest";
import {
  dedupeByNewestUpdatedAt,
  mergeByWeekStart,
} from "@/lib/sync/merge-by-updated-at";
import {
  filterUserFacingSyncErrors,
  isOptionalSyncInfrastructureError,
} from "@/lib/sync/sync-errors";

describe("dedupeByNewestUpdatedAt", () => {
  it("同じ weekStart は新しい方だけ残す", () => {
    const items = [
      {
        id: "a",
        weekStart: "2026-07-20",
        updatedAt: "2026-07-21T00:00:00.000Z",
      },
      {
        id: "b",
        weekStart: "2026-07-20",
        updatedAt: "2026-07-22T00:00:00.000Z",
      },
      {
        id: "c",
        weekStart: "2026-07-27",
        updatedAt: "2026-07-27T00:00:00.000Z",
      },
    ];
    const deduped = dedupeByNewestUpdatedAt(items, (item) => item.weekStart);
    expect(deduped).toHaveLength(2);
    expect(deduped.find((item) => item.weekStart === "2026-07-20")?.id).toBe(
      "b",
    );
  });
});

describe("mergeByWeekStart", () => {
  it("同じ週は updatedAt の新しい方を採用する", () => {
    const local = [
      {
        id: "local-1",
        weekStart: "2026-07-20",
        updatedAt: "2026-07-21T00:00:00.000Z",
      },
    ];
    const remote = [
      {
        id: "remote-1",
        weekStart: "2026-07-20",
        updatedAt: "2026-07-22T00:00:00.000Z",
      },
    ];
    const merged = mergeByWeekStart(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("remote-1");
  });
});

describe("sync-errors", () => {
  it("未整備エラーを判定する", () => {
    expect(
      isOptionalSyncInfrastructureError("stores: 未整備または失敗"),
    ).toBe(true);
    expect(
      isOptionalSyncInfrastructureError(
        "meal_plans: ON CONFLICT DO UPDATE command cannot affect row a second time",
      ),
    ).toBe(false);
  });

  it("ユーザー向けエラーだけ残す", () => {
    expect(
      filterUserFacingSyncErrors([
        "stores: 未整備または失敗",
        "meal_plans: conflict",
        "food_budget_settings: 未整備または失敗",
      ]),
    ).toEqual(["meal_plans: conflict"]);
  });
});
