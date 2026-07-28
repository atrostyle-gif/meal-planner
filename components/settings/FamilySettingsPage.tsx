"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import {
  isValidInviteCode,
  normalizeInviteCode,
} from "@/lib/auth/invite-code";
import {
  buildInviteShareText,
  buildInviteUrl,
  buildLineShareUrl,
} from "@/lib/auth/invite-link";
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

  const inviteUrl = useMemo(() => {
    if (!invite) return null;
    return buildInviteUrl(invite.code);
  }, [invite]);

  const shareText = useMemo(() => {
    if (!invite || !inviteUrl) return null;
    return buildInviteShareText({
      householdName: household?.name ?? "家族",
      code: invite.code,
      inviteUrl,
    });
  }, [invite, inviteUrl, household?.name]);

  useEffect(() => {
    void refreshFamily();
  }, [refreshFamily]);

  async function copyText(text: string, successMessage: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(successMessage);
    } catch {
      setError("コピーできませんでした。手動で選択してコピーしてください。");
    }
  }

  function openLineShare(): void {
    if (!shareText) return;
    window.open(buildLineShareUrl(shareText), "_blank", "noopener,noreferrer");
  }

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
        <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <div>
            <h2 className="text-sm font-medium">家族を招待</h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              LINEでリンクを送ると、相手はログイン後にそのまま参加できます。コードの手入力は不要です。
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setError(null);
              void createInvite()
                .then((created) => {
                  setInvite(created);
                  setMessage("招待リンクを発行しました（72時間有効）");
                })
                .catch((err) => setError(toUserFacingError(err)))
                .finally(() => setLoading(false));
            }}
            className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            {loading ? "発行中…" : "招待リンクを発行"}
          </button>
          {invite && inviteUrl && shareText ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-surface-container px-3 py-3 text-center">
                <p className="text-xs text-on-surface-variant">招待コード</p>
                <p className="mt-1 text-2xl font-bold tracking-widest">
                  {invite.code}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  期限: {new Date(invite.expiresAt).toLocaleString("ja-JP")}
                </p>
              </div>
              <div className="rounded-xl bg-surface-container px-3 py-3">
                <p className="text-xs text-on-surface-variant">招待リンク</p>
                <p className="mt-1 break-all text-sm font-medium text-primary">
                  {inviteUrl}
                </p>
              </div>
              <button
                type="button"
                onClick={openLineShare}
                className="w-full rounded-xl bg-[#06C755] px-3 py-2.5 text-sm font-semibold text-white"
              >
                LINEで招待メッセージを送る
              </button>
              <button
                type="button"
                onClick={() => {
                  void copyText(inviteUrl, "招待リンクをコピーしました");
                }}
                className="w-full rounded-xl bg-secondary-container px-3 py-2.5 text-sm font-semibold text-on-secondary-container"
              >
                リンクをコピー
              </button>
              <button
                type="button"
                onClick={() => {
                  void copyText(invite.code, "招待コードをコピーしました");
                }}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-medium ring-1 ring-outline-variant"
              >
                コードだけコピー
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {!household ? (
        <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <h2 className="text-sm font-medium">招待コードで参加</h2>
          <p className="text-xs text-on-surface-variant">
            リンクがない場合は、ここにコードを入力してください。
          </p>
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
      ) : (
        <section className="rounded-2xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
          <p className="font-medium text-on-surface">参加のしかた</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>上で招待リンクを発行する</li>
            <li>「LINEで招待メッセージを送る」を押す</li>
            <li>相手がリンクを開き、ログイン／登録する</li>
            <li>招待コードは自動で入るので「参加」を押すだけ</li>
          </ol>
        </section>
      )}

      {message ? <p className="text-sm text-on-surface-variant">{message}</p> : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
