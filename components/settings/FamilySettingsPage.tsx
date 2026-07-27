"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import {
  isValidInviteCode,
  normalizeInviteCode,
} from "@/lib/auth/invite-code";
import { toUserFacingError } from "@/lib/supabase/errors";
import type { HouseholdInvite } from "@/types/household";

export function FamilySettingsPage() {
  const {
    mode,
    household,
    members,
    profile,
    createInvite,
    joinHousehold,
    refreshFamily,
  } = useFamilySession();
  const [invite, setInvite] = useState<HouseholdInvite | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const myRole = members.find((member) => member.userId === profile?.id)?.role;
  const isOwner = myRole === "owner";

  useEffect(() => {
    void refreshFamily();
  }, [refreshFamily]);

  if (mode === "local") {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">家族共有</h1>
        <p className="text-sm text-on-surface-variant">
          家族共有は Supabase 設定後に利用できます。
        </p>
        <Link href="/settings" className="text-sm text-primary">
          設定へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/settings" className="text-sm text-primary">
          ← 設定
        </Link>
        <h1 className="text-2xl font-bold">家族共有</h1>
        <p className="text-sm text-on-surface-variant">
          {household?.name ?? "未所属"}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-on-surface-variant">メンバー</h2>
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.userId}
              className="rounded-xl bg-surface-container px-3 py-2.5 text-sm"
            >
              <span className="font-medium">
                {member.displayName || "ユーザー"}
              </span>
              <span className="ml-2 text-on-surface-variant">
                {member.role === "owner" ? "オーナー" : "メンバー"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {isOwner ? (
        <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <h2 className="text-sm font-medium">招待コード発行</h2>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setError(null);
              void createInvite()
                .then((created) => {
                  setInvite(created);
                  setMessage("招待コードを発行しました（72時間有効）");
                })
                .catch((err) => setError(toUserFacingError(err)))
                .finally(() => setLoading(false));
            }}
            className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            {loading ? "発行中…" : "招待コードを発行"}
          </button>
          {invite ? (
            <div className="rounded-xl bg-surface-container px-3 py-3 text-center">
              <p className="text-xs text-on-surface-variant">招待コード</p>
              <p className="mt-1 text-2xl font-bold tracking-widest">
                {invite.code}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                期限: {new Date(invite.expiresAt).toLocaleString("ja-JP")}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {!household ? (
        <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <h2 className="text-sm font-medium">招待コードで参加</h2>
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="招待コード"
            className="w-full rounded-xl bg-surface-container px-3 py-3 uppercase outline-none ring-1 ring-outline-variant"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              const code = normalizeInviteCode(joinCode);
              if (!isValidInviteCode(code)) {
                setError("招待コードの形式が正しくありません");
                return;
              }
              setLoading(true);
              void joinHousehold(code)
                .then(() => setMessage("家庭に参加しました"))
                .catch((err) => setError(toUserFacingError(err)))
                .finally(() => setLoading(false));
            }}
            className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary"
          >
            参加する
          </button>
        </section>
      ) : null}

      {message ? <p className="text-sm text-on-surface-variant">{message}</p> : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
