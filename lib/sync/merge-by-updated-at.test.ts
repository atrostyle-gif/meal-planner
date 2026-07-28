import { describe, expect, it } from "vitest";
import {
  findSameItemConflicts,
  mergeByUpdatedAt,
} from "@/lib/sync/merge-by-updated-at";

type Item = { id: string; updatedAt: string; name: string };

describe("mergeByUpdatedAt", () => {
  it("異なる id は両方残す", () => {
    const local: Item[] = [
      { id: "a", updatedAt: "2026-01-01T00:00:00.000Z", name: "A" },
    ];
    const remote: Item[] = [
      { id: "b", updatedAt: "2026-01-02T00:00:00.000Z", name: "B" },
    ];
    const merged = mergeByUpdatedAt(local, remote);
    expect(merged.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("同じ id は新しい updatedAt を採用する", () => {
    const local: Item[] = [
      { id: "a", updatedAt: "2026-01-01T00:00:00.000Z", name: "古い" },
    ];
    const remote: Item[] = [
      { id: "a", updatedAt: "2026-01-03T00:00:00.000Z", name: "新しい" },
    ];
    const merged = mergeByUpdatedAt(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("新しい");
  });

  it("preferCloudIds は時刻に関係なくクラウドを採用する", () => {
    const local: Item[] = [
      { id: "a", updatedAt: "2026-01-10T00:00:00.000Z", name: "端末" },
    ];
    const remote: Item[] = [
      { id: "a", updatedAt: "2026-01-01T00:00:00.000Z", name: "クラウド" },
    ];
    const merged = mergeByUpdatedAt(local, remote, {
      preferCloudIds: new Set(["a"]),
    });
    expect(merged[0]?.name).toBe("クラウド");
  });
});

describe("findSameItemConflicts", () => {
  const lastSyncedAt = Date.parse("2026-01-05T00:00:00.000Z");

  it("片方だけの更新は競合にしない", () => {
    const local: Item[] = [
      { id: "a", updatedAt: "2026-01-06T00:00:00.000Z", name: "端末のみ" },
    ];
    const remote: Item[] = [
      { id: "b", updatedAt: "2026-01-07T00:00:00.000Z", name: "クラウドのみ" },
    ];
    expect(findSameItemConflicts(local, remote, lastSyncedAt)).toEqual([]);
  });

  it("同じ id を双方が同期後に更新したら競合", () => {
    const local: Item[] = [
      { id: "a", updatedAt: "2026-01-06T00:00:00.000Z", name: "端末" },
    ];
    const remote: Item[] = [
      { id: "a", updatedAt: "2026-01-07T00:00:00.000Z", name: "クラウド" },
    ];
    const conflicts = findSameItemConflicts(local, remote, lastSyncedAt);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.id).toBe("a");
  });

  it("同期前の更新だけでは競合にしない", () => {
    const local: Item[] = [
      { id: "a", updatedAt: "2026-01-04T00:00:00.000Z", name: "端末" },
    ];
    const remote: Item[] = [
      { id: "a", updatedAt: "2026-01-03T00:00:00.000Z", name: "クラウド" },
    ];
    expect(findSameItemConflicts(local, remote, lastSyncedAt)).toEqual([]);
  });
});
