"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import {
  isValidInviteCode,
  normalizeInviteCode,
} from "@/lib/auth/invite-code";
import { readInviteCodeFromSearch } from "@/lib/auth/invite-link";
import { toUserFacingError } from "@/lib/supabase/errors";

export function SetupHouseholdPage() {
  const { mode, createHousehold, joinHousehold, household, signOut } =
    useFamilySession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = readInviteCodeFromSearch(searchParams);
  const [tabDraft, setTabDraft] = useState<"create" | "join" | null>(null);
  const [householdName, setHouseholdName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCodeDraft, setInviteCodeDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tab = tabDraft ?? (codeFromUrl ? "join" : "create");
  const inviteCode = inviteCodeDraft ?? codeFromUrl ?? "";

  useEffect(() => {
    if (mode === "local" || household) {
      router.replace("/today");
    }
  }, [mode, household, router]);

  if (mode === "local" || household) {
    return <p className="text-sm text-on-surface-variant">移動中…</p>;
  }

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createHousehold(householdName, displayName);
      router.replace("/today");
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(event: FormEvent): Promise<void> {
    event.preventDefault();
    const code = normalizeInviteCode(inviteCode);
    if (!isValidInviteCode(code)) {
      setError("招待コードの形式が正しくありません。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await joinHousehold(code, displayName || undefined);
      router.replace("/today");
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 py-6">
      <header>
        <h1 className="text-2xl font-bold">家庭の設定</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          家族でデータを共有するために、家庭を作成するか招待コードで参加してください。
        </p>
        {codeFromUrl ? (
          <p className="mt-2 rounded-xl bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
            招待リンクのコードを入力済みです。表示名を入れて参加してください。
          </p>
        ) : null}
      </header>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTabDraft("create")}
          className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium ${
            tab === "create"
              ? "bg-primary text-on-primary"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          家庭を作る
        </button>
        <button
          type="button"
          onClick={() => setTabDraft("join")}
          className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium ${
            tab === "join"
              ? "bg-primary text-on-primary"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          招待コードで参加
        </button>
      </div>

      {tab === "create" ? (
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            required
            value={householdName}
            onChange={(event) => setHouseholdName(event.target.value)}
            placeholder="家庭名（例: 平元家）"
            className="w-full rounded-xl bg-surface-container px-3 py-3 outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="あなたの表示名"
            className="w-full rounded-xl bg-surface-container px-3 py-3 outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-primary px-4 py-3.5 font-semibold text-on-primary disabled:opacity-60"
          >
            {loading ? "作成中…" : "家庭を作成"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} className="space-y-3">
          <input
            required
            value={inviteCode}
            onChange={(event) => setInviteCodeDraft(event.target.value)}
            placeholder="招待コード"
            className="w-full rounded-xl bg-surface-container px-3 py-3 uppercase outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="あなたの表示名（任意）"
            className="w-full rounded-xl bg-surface-container px-3 py-3 outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-primary px-4 py-3.5 font-semibold text-on-primary disabled:opacity-60"
          >
            {loading ? "参加中…" : "家庭に参加"}
          </button>
        </form>
      )}

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <button
        type="button"
        onClick={() => void signOut()}
        className="w-full text-sm text-on-surface-variant"
      >
        ログアウト
      </button>
    </div>
  );
}
