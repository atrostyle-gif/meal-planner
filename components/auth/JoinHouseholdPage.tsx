"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import {
  isValidInviteCode,
  normalizeInviteCode,
} from "@/lib/auth/invite-code";
import { readInviteCodeFromSearch } from "@/lib/auth/invite-link";
import { toUserFacingError } from "@/lib/supabase/errors";

/**
 * 招待リンクの入口。
 * 未ログイン → ログインへ（復帰先にコード付き）
 * ログイン済・未所属 → コード自動入力して参加
 * 既に所属 → 案内のみ
 */
export function JoinHouseholdPage() {
  const { mode, ready, session, household, joinHousehold, profile } =
    useFamilySession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = readInviteCodeFromSearch(searchParams);

  const [inviteCodeDraft, setInviteCodeDraft] = useState<string | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const inviteCode = inviteCodeDraft ?? codeFromUrl ?? "";
  const displayName =
    displayNameDraft ?? profile?.displayName ?? "";

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (mode === "local") {
      return;
    }
    if (!session) {
      const next = codeFromUrl
        ? `/join?code=${encodeURIComponent(codeFromUrl)}`
        : "/join";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [ready, mode, session, codeFromUrl, router]);

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
      await joinHousehold(code, displayName.trim() || undefined);
      setMessage("家庭に参加しました");
      router.replace("/today");
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  if (mode === "local") {
    return (
      <div className="space-y-4 py-6">
        <h1 className="text-2xl font-bold">家族への参加</h1>
        <p className="text-sm text-on-surface-variant">
          家族共有はクラウド設定後に利用できます。
        </p>
        <Link href="/today" className="text-sm text-primary">
          アプリへ戻る
        </Link>
      </div>
    );
  }

  if (!session) {
    return <p className="text-sm text-on-surface-variant">ログイン画面へ移動中…</p>;
  }

  if (household) {
    return (
      <div className="space-y-4 py-6">
        <h1 className="text-2xl font-bold">家族への参加</h1>
        <p className="text-sm text-on-surface-variant">
          すでに「{household.name}」に参加しています。
        </p>
        <Link
          href="/today"
          className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
        >
          今日の献立へ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">家族への参加</h1>
        <p className="text-sm text-on-surface-variant">
          {codeFromUrl
            ? "招待リンクから来ました。表示名を確認して参加してください。"
            : "招待コードを入力して家族に参加します。"}
        </p>
      </header>

      <form onSubmit={handleJoin} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">招待コード</span>
          <input
            required
            value={inviteCode}
            onChange={(event) => setInviteCodeDraft(event.target.value)}
            placeholder="招待コード"
            className="w-full rounded-xl bg-surface-container px-3 py-3 text-center text-xl font-bold tracking-widest uppercase outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
            autoComplete="off"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">あなたの表示名</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayNameDraft(event.target.value)}
            placeholder="例: 花子"
            className="w-full rounded-xl bg-surface-container px-3 py-3 outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
        </label>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        {message ? (
          <p className="text-sm text-on-surface-variant">{message}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-primary px-4 py-3.5 font-semibold text-on-primary disabled:opacity-60"
        >
          {loading ? "参加中…" : "この家族に参加する"}
        </button>
      </form>
    </div>
  );
}
